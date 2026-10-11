import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// S6: setiap permintaan harus membawa token dari penyedia identitas (Keycloak).
// AUTH_ISSUER kosong berarti pemeriksaan dimatikan; itu hanya untuk uji S1 sampai S5
// di spike ini dan tidak boleh ada di aplikasi sungguhan.

const TERBUKA = 'terbuka';
const PERAN = 'peran';
/** Alamat yang boleh dipanggil tanpa token, misalnya health check. */
export const Terbuka = () => SetMetadata(TERBUKA, true);
/** Peran yang wajib dimiliki pemanggil. */
export const Peran = (...peran: string[]) => SetMetadata(PERAN, peran);

export interface Pengguna { nama: string; peran: string[] }

@Injectable()
export class PenjagaToken implements CanActivate {
  private readonly penerbit = process.env.AUTH_ISSUER;
  // Kunci publik diambil dari penyedia identitas dan disimpan sementara oleh pustaka jose.
  private readonly kunci = this.penerbit
    ? createRemoteJWKSet(new URL(`${this.penerbit}/protocol/openid-connect/certs`))
    : undefined;

  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.penerbit || !this.kunci) return true;
    const sasaran = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(TERBUKA, sasaran)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [jenis, token] = String(req.headers.authorization ?? '').split(' ');
    if (jenis !== 'Bearer' || !token) throw new UnauthorizedException('Token wajib disertakan');

    let klaim: Record<string, unknown>;
    try {
      // Tanda tangan, penerbit, dan masa berlaku diperiksa di sini.
      ({ payload: klaim } = await jwtVerify(token, this.kunci, { issuer: this.penerbit, algorithms: ['RS256'] }));
    } catch {
      throw new UnauthorizedException('Token tidak sah');
    }

    const peran = (klaim.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
    req.pengguna = { nama: String(klaim.preferred_username ?? klaim.sub), peran } satisfies Pengguna;

    const perlu = this.reflector.getAllAndOverride<string[]>(PERAN, sasaran);
    if (perlu?.length && !perlu.some((p) => peran.includes(p))) {
      throw new ForbiddenException(`Perlu peran: ${perlu.join(', ')}`);
    }
    return true;
  }
}
