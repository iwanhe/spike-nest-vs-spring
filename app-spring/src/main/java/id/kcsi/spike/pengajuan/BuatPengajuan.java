package id.kcsi.spike.pengajuan;

import java.math.BigDecimal;
import java.util.List;

public record BuatPengajuan(String nomor, String pemohon, String pemasok, List<Baris> baris) {
  public record Baris(String namaBarang, BigDecimal jumlah, BigDecimal hargaSatuan) {}
}
