import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { ENV } from '../config/env.js';
import type { JwtUserPayload, DesignationClaim } from '../types/auth.js';

export class JwtService {
  /**
   * Generates a signed JWT with standard claims and tenant authorization payload
   */
  public static signToken(params: {
    userId: string;
    companyId: string;
    companyCode: string;
    email: string;
    employeeId?: string | null;
    designation?: DesignationClaim | null;
    roles: string[];
    permissions: string[];
  }): string {
    const jti = crypto.randomUUID();

    const payload: Partial<JwtUserPayload> = {
      sub: params.userId,
      company_id: params.companyId,
      company_code: params.companyCode,
      email: params.email,
      roles: params.roles,
      permissions: params.permissions,
    };

    if (params.employeeId) {
      payload.employee_id = params.employeeId;
    }

    if (params.designation) {
      payload.designation = {
        id: params.designation.id,
        code: params.designation.code,
        name: params.designation.name,
      };
    }

    const token = jwt.sign(payload, ENV.JWT.SECRET, {
      algorithm: ENV.JWT.ALGORITHM,
      expiresIn: ENV.JWT.EXPIRES_IN as jwt.SignOptions['expiresIn'],
      issuer: ENV.JWT.ISSUER,
      audience: ENV.JWT.AUDIENCE,
      jwtid: jti,
    });

    return token;
  }

  /**
   * Verifies and decodes a JWT token using strict algorithm and audience checks
   */
  public static verifyToken(token: string): JwtUserPayload {
    try {
      const decoded = jwt.verify(token, ENV.JWT.SECRET, {
        algorithms: [ENV.JWT.ALGORITHM],
        issuer: ENV.JWT.ISSUER,
        audience: ENV.JWT.AUDIENCE,
      }) as JwtUserPayload;

      if (!decoded.sub || !decoded.company_id || !decoded.company_code) {
        throw new Error('Token payload is missing mandatory tenant or subject claims');
      }

      return decoded;
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid token: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * Decode token without verification (e.g. for inspection)
   */
  public static decodeToken(token: string): JwtUserPayload | null {
    return jwt.decode(token) as JwtUserPayload | null;
  }
}
