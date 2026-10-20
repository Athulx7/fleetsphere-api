import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/auth.js';

export class EmployeeController {
  /**
   * GET /api/employees
   * Retrieves employees exclusively from the authenticated client's database
   */
  public static async getEmployees(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({
        success: false,
        message: 'Tenant context is missing',
      });
      return;
    }

    const { db, tenant } = req.tenantContext;

    try {
      const result = await db.query(
        `SELECT 
           e.u_employee_id, 
           e.c_employee_code, 
           e.c_first_name, 
           e.c_last_name, 
           e.c_email, 
           e.d_joining_date, 
           e.b_is_active,
           d.u_designation_id,
           d.c_designation_code,
           d.c_designation_name
         FROM public.tbl_employee_mst e
         LEFT JOIN public.tbl_designation_mst d 
           ON e.u_designation_id = d.u_designation_id AND d.b_is_active = TRUE
         WHERE e.b_is_active = TRUE
         ORDER BY e.c_first_name ASC;`
      );

      res.status(200).json({
        success: true,
        data: {
          tenant: {
            company_code: tenant.companyCode,
            company_name: tenant.companyName,
          },
          employees: result.rows.map((row) => ({
            id: row.u_employee_id,
            code: row.c_employee_code,
            first_name: row.c_first_name,
            last_name: row.c_last_name,
            email: row.c_email,
            joining_date: row.d_joining_date,
            designation: row.c_designation_code
              ? {
                  id: row.u_designation_id,
                  code: row.c_designation_code,
                  name: row.c_designation_name,
                }
              : null,
          })),
        },
      });
    } catch (err) {
      console.error('[EmployeeController.getEmployees Error]:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve employees for tenant',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * POST /api/employees
   * Creates employee (requires 'employee.create' permission)
   */
  public static async createEmployee(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({
        success: false,
        message: 'Tenant context is missing',
      });
      return;
    }

    const { db } = req.tenantContext;
    const { employee_code, first_name, last_name, email } = req.body;

    if (!employee_code || !first_name) {
      res.status(400).json({
        success: false,
        message: 'Employee code and first name are required',
      });
      return;
    }

    try {
      const result = await db.query(
        `INSERT INTO public.tbl_employee_mst (
           c_employee_code, c_first_name, c_last_name, c_email, b_is_active, d_created_at
         ) VALUES ($1, $2, $3, $4, true, NOW())
         RETURNING u_employee_id, c_employee_code, c_first_name, c_last_name, c_email;`,
        [employee_code, first_name, last_name || null, email || null]
      );

      res.status(201).json({
        success: true,
        message: 'Employee created successfully in tenant database',
        data: result.rows[0],
      });
    } catch (err) {
      console.error('[EmployeeController.createEmployee Error]:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to create employee',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
