import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { JwtAuthGuard, RolesGuard } from './guards';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, PasswordService, TokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
