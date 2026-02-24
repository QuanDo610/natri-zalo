import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  username?: string;
  phone?: string;
  role: 'ADMIN' | 'STAFF' | 'DEALER' | 'CUSTOMER';
  customerId?: string;
  dealerId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'default-secret'),
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      username: payload.username,
      phone: payload.phone,
      role: payload.role,
      customerId: payload.customerId,
      dealerId: payload.dealerId,
    };
  }
}
