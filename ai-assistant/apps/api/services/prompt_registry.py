"""
Prompt Registry - Version-controlled prompt management.

Prompts are stored as files, never hard-coded in application logic.
Each prompt has multiple versions for A/B testing and iteration.
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import structlog

logger = structlog.get_logger()


@dataclass
class PromptVersion:
    """A specific version of a prompt."""
    id: str
    version: str
    content: str
    description: str
    created_at: str
    metadata: dict


class PromptRegistry:
    """
    Manages versioned prompts from the filesystem.
    
    Directory structure:
    /prompts
      /system
        shell_assistant.txt      # Latest system prompt
      /versions
        shell_assistant_v1.txt
        shell_assistant_v2.txt
      prompt_registry.json       # Registry metadata
    """
    
    def __init__(self, prompts_dir: str = "./prompts"):
        self.prompts_dir = Path(prompts_dir)
        self.registry: Dict[str, Dict[str, PromptVersion]] = {}
        self._load_registry()
    
    def _load_registry(self):
        """Load prompt registry from disk."""
        registry_file = self.prompts_dir / "prompt_registry.json"
        
        if registry_file.exists():
            with open(registry_file) as f:
                registry_data = json.load(f)
        else:
            registry_data = {"prompts": {}}
        
        # Load all prompts
        for prompt_id, meta in registry_data.get("prompts", {}).items():
            self.registry[prompt_id] = {}
            
            for version_info in meta.get("versions", []):
                version = version_info["version"]
                file_path = self.prompts_dir / version_info["file"]
                
                if file_path.exists():
                    with open(file_path) as f:
                        content = f.read()
                    
                    self.registry[prompt_id][version] = PromptVersion(
                        id=prompt_id,
                        version=version,
                        content=content,
                        description=version_info.get("description", ""),
                        created_at=version_info.get("created_at", ""),
                        metadata=version_info.get("metadata", {})
                    )
            
            # Set latest
            if meta.get("latest"):
                self.registry[prompt_id]["latest"] = self.registry[prompt_id].get(
                    meta["latest"],
                    list(self.registry[prompt_id].values())[0] if self.registry[prompt_id] else None
                )
        
        # Also load from /system directory (convenience)
        system_dir = self.prompts_dir / "system"
        if system_dir.exists():
            for prompt_file in system_dir.glob("*.txt"):
                prompt_id = prompt_file.stem
                if prompt_id not in self.registry:
                    self.registry[prompt_id] = {}
                
                with open(prompt_file) as f:
                    content = f.read()
                
                # Create default version
                self.registry[prompt_id]["v1"] = PromptVersion(
                    id=prompt_id,
                    version="v1",
                    content=content,
                    description="Default system prompt",
                    created_at="",
                    metadata={}
                )
                self.registry[prompt_id]["latest"] = self.registry[prompt_id]["v1"]
        
        logger.info(
            "Prompt registry loaded",
            prompt_count=len(self.registry),
            prompts=list(self.registry.keys())
        )
    
    def get_prompt(self, prompt_id: str, version: str = "latest") -> str:
        """
        Get prompt content by ID and version.
        
        Args:
            prompt_id: Identifier of the prompt
            version: Version string or "latest"
        
        Returns:
            Prompt content string
        
        Raises:
            KeyError if prompt or version not found
        """
        if prompt_id not in self.registry:
            logger.error("Prompt not found", prompt_id=prompt_id)
            raise KeyError(f"Prompt '{prompt_id}' not found")
        
        versions = self.registry[prompt_id]
        
        if version not in versions:
            logger.error(
                "Prompt version not found",
                prompt_id=prompt_id,
                version=version,
                available=list(versions.keys())
            )
            raise KeyError(f"Version '{version}' not found for prompt '{prompt_id}'")
        
        prompt_version = versions[version]
        
        logger.debug(
            "Prompt retrieved",
            prompt_id=prompt_id,
            version=prompt_version.version
        )
        
        return prompt_version.content
    
    def get_version_info(self, prompt_id: str, version: str = "latest") -> PromptVersion:
        """Get full version info including metadata."""
        if prompt_id not in self.registry:
            raise KeyError(f"Prompt '{prompt_id}' not found")
        
        versions = self.registry[prompt_id]
        if version not in versions:
            raise KeyError(f"Version '{version}' not found")
        
        return versions[version]
    
    def list_prompts(self) -> list[dict]:
        """List all available prompts and their versions."""
        result = []
        for prompt_id, versions in self.registry.items():
            result.append({
                "id": prompt_id,
                "versions": [v for v in versions.keys() if v != "latest"],
                "latest": versions.get("latest").version if versions.get("latest") else None
            })
        return result
    
    def reload(self):
        """Reload prompts from disk (hot reload)."""
        self.registry = {}
        self._load_registry()
        logger.info("Prompt registry reloaded")
