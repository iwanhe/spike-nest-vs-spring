package id.kcsi.spike.pengajuan;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "pengajuan_baris")
public class PengajuanBaris {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "pengajuan_id")
  Pengajuan pengajuan;

  String namaBarang; // kolom nama_barang
  BigDecimal jumlah;
  BigDecimal hargaSatuan; // kolom harga_satuan
}
