package id.kcsi.spike.persetujuan;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// Langkah-langkah yang dipanggil dari diagram BPMN (processes/persetujuan.bpmn20.xml).
// Semuanya berjalan di transaksi yang sama dengan mesin alur.
@Component("persetujuanAksi")
public class PersetujuanAksi {
  private final JdbcTemplate jdbc;

  public PersetujuanAksi(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public void tandaiDiajukan(String pengajuanId) {
    ubahStatus(pengajuanId, "DIAJUKAN");
  }

  public void catat(String pengajuanId, String keputusan, String penyetuju) {
    jdbc.update(
        "INSERT INTO persetujuan (pengajuan_id, penyetuju, keputusan) VALUES (?::uuid, ?, ?)",
        pengajuanId, penyetuju, keputusan);
    ubahStatus(pengajuanId, "SETUJU".equals(keputusan) ? "DISETUJUI" : "DITOLAK");
  }

  public void eskalasi(String pengajuanId) {
    jdbc.update(
        "INSERT INTO persetujuan (pengajuan_id, penyetuju, keputusan) VALUES (?::uuid, 'sistem', 'ESKALASI')",
        pengajuanId);
    ubahStatus(pengajuanId, "ESKALASI");
  }

  private void ubahStatus(String pengajuanId, String status) {
    jdbc.update("UPDATE pengajuan SET status = ? WHERE id = ?::uuid", status, pengajuanId);
  }
}
