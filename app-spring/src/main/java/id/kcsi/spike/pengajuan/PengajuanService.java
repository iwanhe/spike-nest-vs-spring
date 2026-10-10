package id.kcsi.spike.pengajuan;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PengajuanService {
  private final PengajuanRepository repo;
  private final JdbcTemplate jdbc;

  public PengajuanService(PengajuanRepository repo, JdbcTemplate jdbc) {
    this.repo = repo;
    this.jdbc = jdbc;
  }

  // Seluruh isi metode ini satu transaksi:
  // bila ada RuntimeException, semuanya dibatalkan.
  @Transactional
  public PengajuanView buat(BuatPengajuan dto, String ujiGagal) {
    Pengajuan p = new Pengajuan();
    p.nomor = dto.nomor();
    p.pemohon = dto.pemohon();
    p.pemasok = dto.pemasok();

    BigDecimal total = BigDecimal.ZERO;
    for (BuatPengajuan.Baris b : dto.baris()) {
      PengajuanBaris baris = new PengajuanBaris();
      baris.pengajuan = p;
      baris.namaBarang = b.namaBarang();
      baris.jumlah = b.jumlah();
      baris.hargaSatuan = b.hargaSatuan();
      p.baris.add(baris);
      total = total.add(b.jumlah().multiply(b.hargaSatuan()));
    }
    p.total = total.setScale(2, RoundingMode.HALF_UP);
    repo.saveAndFlush(p);

    // Hanya untuk uji: sengaja gagal di tengah transaksi.
    if ("1".equals(System.getenv("MODE_UJI")) && "setelah-baris".equals(ujiGagal)) {
      throw new IllegalStateException("Gagal buatan untuk menguji rollback");
    }

    jdbc.update(
        "INSERT INTO audit_log (entitas, entitas_id, aksi, pelaku) VALUES ('pengajuan', ?, 'BUAT', ?)",
        p.id, p.pemohon);
    jdbc.update(
        "INSERT INTO outbox (pengajuan_id, payload) "
            + "VALUES (?, jsonb_build_object('nomor', ?::text, 'pemasok', ?::text))",
        p.id, p.nomor, p.pemasok);

    return PengajuanView.dari(p);
  }

  @Transactional(readOnly = true)
  public PengajuanView cari(UUID id) {
    return repo.findById(id)
        .map(PengajuanView::dari)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }
}
