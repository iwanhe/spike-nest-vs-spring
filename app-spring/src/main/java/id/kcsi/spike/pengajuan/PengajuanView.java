package id.kcsi.spike.pengajuan;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

// Uang dikirim sebagai teks, bukan angka.
public record PengajuanView(
    UUID id,
    String nomor,
    String status,
    @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal total,
    List<BarisView> baris) {

  public record BarisView(
      String namaBarang,
      @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal jumlah,
      @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal hargaSatuan) {}

  static PengajuanView dari(Pengajuan p) {
    return new PengajuanView(
        p.id,
        p.nomor,
        p.status,
        p.total,
        p.baris.stream().map(b -> new BarisView(b.namaBarang, b.jumlah, b.hargaSatuan)).toList());
  }
}
