import { Controller, Get, Req } from '@nestjs/common';
import { type AnyRequest, Ssr, View, ViewService } from 'nestjs-mvc';
import { Public } from '../auth/public.decorator.js';
import type { User } from '../database/entities/index.js';

@Controller()
export class HomeController {
  constructor(private readonly view: ViewService) {}

  /**
   * The front page for guests, rendered on the server: it's what search
   * engines and link previews see. Logged in, you go straight to Today.
   */
  @Get()
  @Public()
  @Ssr()
  @View('Landing')
  landing(@Req() req: AnyRequest & { user?: User }) {
    if (req.user) return this.view.redirect('/today');
    return {};
  }

  /** The Browse tab on a phone: everything the desktop sidebar has. */
  @Get('browse')
  @View('Browse')
  browse() {
    return {};
  }
}
