import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Ownership guard: ensures the logged-in user's customerId or dealerId
 * matches the requested resource.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, OwnershipGuard)
 *   @OwnershipField('customerId')   // or 'dealerId'
 *
 * The guard compares `req.user[field]` with `req.params[field]` or
 * `req.query[field]`. If they don't match AND the user is not ADMIN/STAFF,
 * the request is rejected.
 */
export const OWNERSHIP_KEY = 'ownership_field';
export const OwnershipField = (field: string) =>
  Reflector.createDecorator<string>()(field);

// Decorator factory (string-based, works with SetMetadata)
import { SetMetadata } from '@nestjs/common';
export const CheckOwnership = (field: string) =>
  SetMetadata(OWNERSHIP_KEY, field);

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const field = this.reflector.getAllAndOverride<string>(OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No ownership requirement set → allow
    if (!field) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // ADMIN and STAFF bypass ownership checks
    if (user.role === 'ADMIN' || user.role === 'STAFF') {
      return true;
    }

    const userValue = user[field];
    const paramValue = request.params?.[field] || request.query?.[field];

    if (!userValue || !paramValue) {
      throw new ForbiddenException('Access denied — missing ownership data');
    }

    if (userValue !== paramValue) {
      throw new ForbiddenException('Access denied — you do not own this resource');
    }

    return true;
  }
}
