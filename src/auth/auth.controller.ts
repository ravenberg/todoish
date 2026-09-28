import {
  Body,
  Controller,
  Get,
  Injectable,
  type PipeTransform,
  Post,
  Res,
} from '@nestjs/common';
import {
  type AnyResponse,
  ValidationException,
  View,
  ViewService,
} from 'nestjs-mvc';
import { z } from 'zod';
import { validateWith } from '../common/validate.js';
import { AccountsService } from './accounts.service.js';
import {
  LoginSchema,
  type RegisterInput,
  registerSchema,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';

/** The sign-up schema needs the database for "is this email taken". */
@Injectable()
export class RegisterPipe implements PipeTransform {
  constructor(private readonly accounts: AccountsService) {}

  transform(value: unknown) {
    return validateWith(
      registerSchema((email) => this.accounts.emailTaken(email)),
      value,
    );
  }
}

@Public()
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly accounts: AccountsService,
    private readonly view: ViewService,
  ) {}

  @Get('login')
  @View('Auth/Login')
  loginPage() {
    return {};
  }

  @Post('login')
  async login(
    @Body({ schema: LoginSchema }) body: z.infer<typeof LoginSchema>,
    @Res({ passthrough: true }) res: AnyResponse,
  ) {
    const user = await this.auth.attempt(body.email, body.password);
    if (!user)
      throw new ValidationException({
        email: 'These credentials do not match our records.',
      });

    await this.auth.signIn(res, user, body.remember);
    return this.view
      .flash('success', `Welcome back, ${user.name.split(' ')[0]}.`)
      .intended('/today');
  }

  @Get('register')
  @View('Auth/Register')
  registerPage() {
    return {};
  }

  /** The form checks each field live (Precognition) against this same pipe. */
  @Post('register')
  async register(
    @Body(RegisterPipe) body: RegisterInput,
    @Res({ passthrough: true }) res: AnyResponse,
  ) {
    const user = await this.accounts.register(body);
    await this.auth.signIn(res, user);
    return this.view
      .flash(
        'success',
        `Welcome to Todoish, ${user.name.split(' ')[0]}. Your to-dos, ish.`,
      )
      .redirect('/today');
  }

  /**
   * Also clears the browser's history of pages: with history encryption on,
   * the back button can't bring the last user's tasks back.
   */
  @Post('logout')
  logout(@Res({ passthrough: true }) res: AnyResponse) {
    this.auth.signOut(res);
    return this.view.clearHistory().redirect('/login');
  }
}
