import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/auth.js';

interface HeaderRecord {
  master_id: number;
  menu_id: number | null;
  master_code: string;
  table_name: string;
  primary_key: string;
  header_name: string;
  list_title: string;
  description: string | null;
  is_active: boolean;
}

interface SetupFieldRecord {
  id: number;
  master_id: number;
  column_name: string;
  label: string;
  field_type: string;
  priority: number;
  visible: boolean;
  required: boolean;
  readonly: boolean;
  dropdown_source: string | null;
  dropdown_table: string | null;
  dropdown_value_field: string | null;
  dropdown_label_field: string | null;
  dropdown_filter: string | null;
  depends_on: string | null;
  depends_on_field: string | null;
  regex: string | null;
  max_length: number | null;
  min_length: number | null;
  show_in_list: boolean;
  list_label: string | null;
  is_auto_code: boolean;
  code_prefix: string | null;
  code_length: number | null;
  is_disable: boolean;
  list_join_query: string | null;
}

export class DynamicMasterController {
  private static getMasterCode(req: Request): string {
    return String(req.params['masterCode'] || '').trim();
  }

  private static getColumnName(req: Request): string {
    return String(req.params['columnName'] || '').trim();
  }

  private static getId(req: Request): string {
    return String(req.params['id'] || '').trim();
  }

  /**
   * Helper to retrieve metadata for a given master_code
   */
  private static async getMasterMetadata(pool: any, masterCode: string) {
    const headerRes = await pool.query(
      `SELECT * FROM public.tbl_dynamicmaster_header 
       WHERE LOWER(master_code) = LOWER($1) AND is_active = TRUE
       LIMIT 1;`,
      [masterCode]
    );

    if (headerRes.rows.length === 0) {
      throw new Error(`Master "${masterCode}" not found or inactive`);
    }

    const header: HeaderRecord = headerRes.rows[0];
    header.primary_key = header.primary_key || 'id';

    const setupRes = await pool.query(
      `SELECT * FROM public.tbl_dynamicmaster_setup 
       WHERE master_id = $1 
       ORDER BY priority ASC, id ASC;`,
      [header.master_id]
    );

    const fields: SetupFieldRecord[] = setupRes.rows;
    return { header, fields };
  }

  /**
   * GET /api/dynamic-master/:masterCode/metadata
   */
  public static async getMetadata(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const masterCode = DynamicMasterController.getMasterCode(req);

      const { header, fields } = await DynamicMasterController.getMasterMetadata(pool, masterCode);

      res.status(200).json({
        success: true,
        data: { header, fields },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(404).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/dynamic-master/:masterCode
   * Queries list of records with automatic dynamic LEFT JOINs for foreign keys!
   */
  public static async getList(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const masterCode = DynamicMasterController.getMasterCode(req);
      const search = (req.query.search as string || '').trim();

      const { header, fields } = await DynamicMasterController.getMasterMetadata(pool, masterCode);

      // Build Dynamic Query with LEFT JOINs for parent tables
      const selectFields = [`m.*`];
      const joinClauses: string[] = [];
      let joinCount = 0;

      fields.forEach((field) => {
        if (
          field.field_type === 'dropdown' &&
          field.dropdown_table &&
          field.dropdown_value_field &&
          field.dropdown_label_field
        ) {
          joinCount++;
          const alias = `join_${joinCount}`;
          selectFields.push(`${alias}.${field.dropdown_label_field} AS ${field.column_name}_display`);
          joinClauses.push(
            `LEFT JOIN ${field.dropdown_table} ${alias} ON m.${field.column_name}::text = ${alias}.${field.dropdown_value_field}::text`
          );
        }
      });

      let whereClause = `WHERE 1=1`;
      const queryParams: any[] = [];

      // Optional text search across text/textarea fields
      if (search) {
        const textFields = fields.filter((f) => f.field_type === 'text' || f.field_type === 'textarea');
        if (textFields.length > 0) {
          queryParams.push(`%${search}%`);
          const searchConditions = textFields.map((f) => `m.${f.column_name} ILIKE $${queryParams.length}`);
          whereClause += ` AND (${searchConditions.join(' OR ')})`;
        }
      }

      const sql = `
        SELECT ${selectFields.join(', ')}
        FROM ${header.table_name} m
        ${joinClauses.join(' ')}
        ${whereClause}
        ORDER BY m.${header.primary_key} DESC;
      `;

      const listRes = await pool.query(sql, queryParams);

      res.status(200).json({
        success: true,
        data: {
          header,
          fields,
          records: listRes.rows,
          total: listRes.rows.length,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/dynamic-master/:masterCode/:id
   * Fetches single record by primary key
   */
  public static async getRecordById(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const masterCode = DynamicMasterController.getMasterCode(req);
      const id = DynamicMasterController.getId(req);

      const { header } = await DynamicMasterController.getMasterMetadata(pool, masterCode);

      const resRow = await pool.query(
        `SELECT * FROM ${header.table_name} WHERE ${header.primary_key}::text = $1 LIMIT 1;`,
        [id]
      );

      if (resRow.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Record not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: resRow.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/dynamic-master/:masterCode/dropdown/:columnName
   * Dynamic lookup returning [{ value, label }]
   */
  public static async getDropdownOptions(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const masterCode = DynamicMasterController.getMasterCode(req);
      const columnName = DynamicMasterController.getColumnName(req);
      const parentValue = req.query.parentValue as string | undefined;

      const { fields } = await DynamicMasterController.getMasterMetadata(pool, masterCode);
      const field = fields.find((f) => f.column_name.toLowerCase() === columnName.toLowerCase());

      if (!field || !field.dropdown_table || !field.dropdown_value_field || !field.dropdown_label_field) {
        res.status(400).json({
          success: false,
          message: `Column "${columnName}" is not configured as a dynamic dropdown.`,
        });
        return;
      }

      let whereConditions: string[] = [];
      const queryParams: any[] = [];

      if (field.dropdown_filter) {
        whereConditions.push(field.dropdown_filter);
      }

      // Handle cascading dependency
      if (field.depends_on && field.depends_on_field && parentValue) {
        queryParams.push(parentValue);
        whereConditions.push(`${field.depends_on_field}::text = $${queryParams.length}`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const sql = `
        SELECT 
          ${field.dropdown_value_field} AS value,
          ${field.dropdown_label_field} AS label
        FROM ${field.dropdown_table}
        ${whereClause}
        ORDER BY ${field.dropdown_label_field} ASC;
      `;

      const optionsRes = await pool.query(sql, queryParams);

      res.status(200).json({
        success: true,
        data: optionsRes.rows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/dynamic-master/:masterCode/next-code/:columnName
   * Generates next auto-code (e.g. 'H004')
   */
  public static async getNextCode(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const masterCode = DynamicMasterController.getMasterCode(req);
      const columnName = DynamicMasterController.getColumnName(req);

      const { header, fields } = await DynamicMasterController.getMasterMetadata(pool, masterCode);
      const field = fields.find((f) => f.column_name.toLowerCase() === columnName.toLowerCase());

      if (!field || !field.is_auto_code) {
        res.status(400).json({ success: false, message: 'Field is not configured for auto-code' });
        return;
      }

      const prefix = field.code_prefix || '';
      const length = field.code_length || 3;

      const countRes = await pool.query(`SELECT COUNT(*) FROM ${header.table_name};`);
      const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
      const nextCode = `${prefix}${String(nextNum).padStart(length, '0')}`;

      res.status(200).json({
        success: true,
        data: { code: nextCode },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/dynamic-master/:masterCode
   * Dynamically inserts a record
   */
  public static async createRecord(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const masterCode = DynamicMasterController.getMasterCode(req);
      const payload = req.body || {};

      const { header, fields } = await DynamicMasterController.getMasterMetadata(pool, masterCode);

      // Handle auto-code if empty
      for (const f of fields) {
        if (f.is_auto_code && (!payload[f.column_name] || !String(payload[f.column_name]).trim())) {
          const countRes = await pool.query(`SELECT COUNT(*) FROM ${header.table_name};`);
          const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
          payload[f.column_name] = `${f.code_prefix || ''}${String(nextNum).padStart(f.code_length || 3, '0')}`;
        }
      }

      // Validate required fields
      for (const f of fields) {
        if (f.required && (payload[f.column_name] === undefined || payload[f.column_name] === null || payload[f.column_name] === '')) {
          res.status(400).json({
            success: false,
            message: `${f.label} is required.`,
          });
          return;
        }

        // Regex validation
        if (f.regex && payload[f.column_name]) {
          const reg = new RegExp(f.regex);
          if (!reg.test(String(payload[f.column_name]))) {
            res.status(400).json({
              success: false,
              message: `${f.label} has an invalid format.`,
            });
            return;
          }
        }
      }

      // Build dynamic INSERT statement
      const insertColumns: string[] = [];
      const insertPlaceholders: string[] = [];
      const insertValues: any[] = [];

      for (const f of fields) {
        if (payload[f.column_name] !== undefined) {
          insertColumns.push(f.column_name);
          insertValues.push(payload[f.column_name]);
          insertPlaceholders.push(`$${insertValues.length}`);
        }
      }

      if (insertColumns.length === 0) {
        res.status(400).json({ success: false, message: 'No valid fields provided to save.' });
        return;
      }

      const sql = `
        INSERT INTO ${header.table_name} (${insertColumns.join(', ')})
        VALUES (${insertPlaceholders.join(', ')})
        RETURNING *;
      `;

      const insertRes = await pool.query(sql, insertValues);

      res.status(201).json({
        success: true,
        message: `${header.header_name} created successfully.`,
        data: insertRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * PUT /api/dynamic-master/:masterCode/:id
   * Dynamically updates a record
   */
  public static async updateRecord(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const masterCode = DynamicMasterController.getMasterCode(req);
      const id = DynamicMasterController.getId(req);
      const payload = req.body || {};

      const { header, fields } = await DynamicMasterController.getMasterMetadata(pool, masterCode);

      const setClauses: string[] = [];
      const updateValues: any[] = [];

      for (const f of fields) {
        if (payload[f.column_name] !== undefined) {
          updateValues.push(payload[f.column_name]);
          setClauses.push(`${f.column_name} = $${updateValues.length}`);
        }
      }

      if (setClauses.length === 0) {
        res.status(400).json({ success: false, message: 'No fields provided to update.' });
        return;
      }

      updateValues.push(id);
      const sql = `
        UPDATE ${header.table_name}
        SET ${setClauses.join(', ')}
        WHERE ${header.primary_key}::text = $${updateValues.length}
        RETURNING *;
      `;

      const updateRes = await pool.query(sql, updateValues);

      if (updateRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Record not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: `${header.header_name} updated successfully.`,
        data: updateRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * DELETE /api/dynamic-master/:masterCode/:id
   */
  public static async deleteRecord(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const masterCode = DynamicMasterController.getMasterCode(req);
      const id = DynamicMasterController.getId(req);

      const { header, fields } = await DynamicMasterController.getMasterMetadata(pool, masterCode);
      const hasActiveCol = fields.some((f) => f.column_name === 'is_active');

      if (hasActiveCol) {
        await pool.query(
          `UPDATE ${header.table_name} SET is_active = FALSE WHERE ${header.primary_key}::text = $1;`,
          [id]
        );
      } else {
        await pool.query(
          `DELETE FROM ${header.table_name} WHERE ${header.primary_key}::text = $1;`,
          [id]
        );
      }

      res.status(200).json({
        success: true,
        message: 'Record deleted successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }
}
