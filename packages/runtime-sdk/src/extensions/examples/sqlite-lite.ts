/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS Extension Example: SQLite-Lite
 *  
 *  A simple in-memory SQL database for SubstrateOS.
 *  Demonstrates how to build a real-world extension.
 */

import type { CommandHandler, CommandContext } from '../../shell';

/**
 * Simple in-memory table storage
 */
interface Table {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

/**
 * SQLite-Lite Extension
 * Provides basic SQL operations in the browser
 */
export class SQLiteLiteExtension {
  private tables: Map<string, Table> = new Map();
  private currentDb: string = 'main';

  /**
   * Get the command handlers for this extension
   */
  getCommands(): Record<string, CommandHandler> {
    return {
      sqlite: this.handleSqlite.bind(this),
      sql: this.handleSql.bind(this),
    };
  }

  /**
   * Main sqlite command handler
   */
  private handleSqlite: CommandHandler = (args, ctx) => {
    if (args.length === 0) {
      this.showHelp(ctx);
      return { exitCode: 0 };
    }

    const cmd = args[0];
    const rest = args.slice(1);

    switch (cmd) {
      case 'help':
        this.showHelp(ctx);
        break;
      case 'tables':
        this.listTables(ctx);
        break;
      case 'create':
        return this.createTable(rest, ctx);
      case 'insert':
        return this.insertRow(rest, ctx);
      case 'select':
        return this.selectRows(rest, ctx);
      case 'drop':
        return this.dropTable(rest, ctx);
      case 'describe':
        return this.describeTable(rest, ctx);
      default:
        ctx.writeError(`Unknown command: ${cmd}`);
        return { exitCode: 1 };
    }

    return { exitCode: 0 };
  };

  /**
   * SQL query handler (direct SQL syntax)
   */
  private handleSql: CommandHandler = (args, ctx) => {
    const query = args.join(' ').trim();
    
    if (!query) {
      ctx.writeln('Usage: sql <query>');
      ctx.writeln('Example: sql SELECT * FROM users');
      return { exitCode: 0 };
    }

    // Parse and execute simple SQL
    const upperQuery = query.toUpperCase();
    
    if (upperQuery.startsWith('CREATE TABLE')) {
      return this.parseCreateTable(query, ctx);
    } else if (upperQuery.startsWith('INSERT INTO')) {
      return this.parseInsert(query, ctx);
    } else if (upperQuery.startsWith('SELECT')) {
      return this.parseSelect(query, ctx);
    } else if (upperQuery.startsWith('DROP TABLE')) {
      return this.parseDropTable(query, ctx);
    } else {
      ctx.writeError('Unsupported SQL command');
      ctx.writeln('Supported: CREATE TABLE, INSERT INTO, SELECT, DROP TABLE');
      return { exitCode: 1 };
    }
  };

  private showHelp(ctx: CommandContext): void {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36mSQLite-Lite - In-Memory SQL Database\x1b[0m');
    ctx.writeln('');
    ctx.writeln('Commands:');
    ctx.writeln('  sqlite tables                  List all tables');
    ctx.writeln('  sqlite create <name> <cols>    Create table');
    ctx.writeln('  sqlite insert <table> <vals>   Insert row');
    ctx.writeln('  sqlite select <table>          Select all rows');
    ctx.writeln('  sqlite describe <table>        Show table structure');
    ctx.writeln('  sqlite drop <table>            Drop table');
    ctx.writeln('');
    ctx.writeln('Or use SQL syntax:');
    ctx.writeln('  sql CREATE TABLE users (id, name, email)');
    ctx.writeln('  sql INSERT INTO users VALUES (1, "Alice", "alice@example.com")');
    ctx.writeln('  sql SELECT * FROM users');
    ctx.writeln('');
  }

  private listTables(ctx: CommandContext): void {
    if (this.tables.size === 0) {
      ctx.writeln('No tables. Use "sqlite create <name> <col1,col2,...>" to create one.');
      return;
    }
    
    ctx.writeln('\x1b[1mTables:\x1b[0m');
    for (const [name, table] of this.tables) {
      ctx.writeln(`  ${name} (${table.columns.length} columns, ${table.rows.length} rows)`);
    }
  }

  private createTable(args: string[], ctx: CommandContext): { exitCode: number } {
    if (args.length < 2) {
      ctx.writeError('Usage: sqlite create <name> <col1,col2,...>');
      return { exitCode: 1 };
    }

    const name = args[0];
    const columns = args[1].split(',').map(c => c.trim());

    if (this.tables.has(name)) {
      ctx.writeError(`Table "${name}" already exists`);
      return { exitCode: 1 };
    }

    this.tables.set(name, { name, columns, rows: [] });
    ctx.writeln(`\x1b[32mCreated table "${name}" with columns: ${columns.join(', ')}\x1b[0m`);
    return { exitCode: 0 };
  }

  private insertRow(args: string[], ctx: CommandContext): { exitCode: number } {
    if (args.length < 2) {
      ctx.writeError('Usage: sqlite insert <table> <val1,val2,...>');
      return { exitCode: 1 };
    }

    const tableName = args[0];
    const table = this.tables.get(tableName);
    
    if (!table) {
      ctx.writeError(`Table "${tableName}" not found`);
      return { exitCode: 1 };
    }

    const values = args[1].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    
    if (values.length !== table.columns.length) {
      ctx.writeError(`Expected ${table.columns.length} values, got ${values.length}`);
      return { exitCode: 1 };
    }

    const row: Record<string, unknown> = {};
    table.columns.forEach((col, i) => {
      // Try to parse as number
      const num = parseFloat(values[i]);
      row[col] = isNaN(num) ? values[i] : num;
    });
    
    table.rows.push(row);
    ctx.writeln(`\x1b[32mInserted row into "${tableName}"\x1b[0m`);
    return { exitCode: 0 };
  }

  private selectRows(args: string[], ctx: CommandContext): { exitCode: number } {
    if (args.length < 1) {
      ctx.writeError('Usage: sqlite select <table>');
      return { exitCode: 1 };
    }

    const tableName = args[0];
    const table = this.tables.get(tableName);
    
    if (!table) {
      ctx.writeError(`Table "${tableName}" not found`);
      return { exitCode: 1 };
    }

    this.printTable(table, ctx);
    return { exitCode: 0 };
  }

  private printTable(table: Table, ctx: CommandContext): void {
    if (table.rows.length === 0) {
      ctx.writeln('(empty table)');
      return;
    }

    // Calculate column widths
    const widths: number[] = table.columns.map(col => col.length);
    for (const row of table.rows) {
      table.columns.forEach((col, i) => {
        const val = String(row[col] ?? '');
        widths[i] = Math.max(widths[i], val.length);
      });
    }

    // Print header
    const header = table.columns.map((col, i) => col.padEnd(widths[i])).join(' | ');
    const separator = widths.map(w => '-'.repeat(w)).join('-+-');
    
    ctx.writeln(`\x1b[1m${header}\x1b[0m`);
    ctx.writeln(separator);

    // Print rows
    for (const row of table.rows) {
      const line = table.columns.map((col, i) => 
        String(row[col] ?? '').padEnd(widths[i])
      ).join(' | ');
      ctx.writeln(line);
    }
    
    ctx.writeln(`\n(${table.rows.length} rows)`);
  }

  private dropTable(args: string[], ctx: CommandContext): { exitCode: number } {
    if (args.length < 1) {
      ctx.writeError('Usage: sqlite drop <table>');
      return { exitCode: 1 };
    }

    const tableName = args[0];
    if (!this.tables.has(tableName)) {
      ctx.writeError(`Table "${tableName}" not found`);
      return { exitCode: 1 };
    }

    this.tables.delete(tableName);
    ctx.writeln(`\x1b[33mDropped table "${tableName}"\x1b[0m`);
    return { exitCode: 0 };
  }

  private describeTable(args: string[], ctx: CommandContext): { exitCode: number } {
    if (args.length < 1) {
      ctx.writeError('Usage: sqlite describe <table>');
      return { exitCode: 1 };
    }

    const tableName = args[0];
    const table = this.tables.get(tableName);
    
    if (!table) {
      ctx.writeError(`Table "${tableName}" not found`);
      return { exitCode: 1 };
    }

    ctx.writeln(`\x1b[1mTable: ${tableName}\x1b[0m`);
    ctx.writeln(`Columns: ${table.columns.length}`);
    ctx.writeln(`Rows: ${table.rows.length}`);
    ctx.writeln('');
    ctx.writeln('Schema:');
    table.columns.forEach((col, i) => {
      ctx.writeln(`  ${i + 1}. ${col}`);
    });
    
    return { exitCode: 0 };
  }

  // SQL parsing helpers
  private parseCreateTable(query: string, ctx: CommandContext): { exitCode: number } {
    // CREATE TABLE name (col1, col2, ...)
    const match = query.match(/CREATE\s+TABLE\s+(\w+)\s*\(([^)]+)\)/i);
    if (!match) {
      ctx.writeError('Invalid CREATE TABLE syntax');
      return { exitCode: 1 };
    }
    
    const name = match[1];
    const columns = match[2].split(',').map(c => c.trim().split(/\s+/)[0]);
    
    return this.createTable([name, columns.join(',')], ctx);
  }

  private parseInsert(query: string, ctx: CommandContext): { exitCode: number } {
    // INSERT INTO table VALUES (v1, v2, ...)
    const match = query.match(/INSERT\s+INTO\s+(\w+)\s+VALUES\s*\(([^)]+)\)/i);
    if (!match) {
      ctx.writeError('Invalid INSERT syntax');
      return { exitCode: 1 };
    }
    
    const table = match[1];
    const values = match[2];
    
    return this.insertRow([table, values], ctx);
  }

  private parseSelect(query: string, ctx: CommandContext): { exitCode: number } {
    // SELECT * FROM table [WHERE ...]
    const match = query.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
    if (!match) {
      ctx.writeError('Invalid SELECT syntax (only SELECT * FROM table supported)');
      return { exitCode: 1 };
    }
    
    return this.selectRows([match[1]], ctx);
  }

  private parseDropTable(query: string, ctx: CommandContext): { exitCode: number } {
    // DROP TABLE name
    const match = query.match(/DROP\s+TABLE\s+(\w+)/i);
    if (!match) {
      ctx.writeError('Invalid DROP TABLE syntax');
      return { exitCode: 1 };
    }
    
    return this.dropTable([match[1]], ctx);
  }
}

/**
 * Create and register the SQLite-Lite extension
 */
export function createSQLiteLiteExtension(): SQLiteLiteExtension {
  return new SQLiteLiteExtension();
}

export default SQLiteLiteExtension;
