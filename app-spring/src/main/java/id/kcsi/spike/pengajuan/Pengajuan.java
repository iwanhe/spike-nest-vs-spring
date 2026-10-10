package id.kcsi.spike.pengajuan;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "pengajuan")
public class Pengajuan {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  UUID id;

  String nomor;
  String pemohon;
  String pemasok;
  String status = "DRAF";

  // Uang selalu BigDecimal, tidak pernah double.
  BigDecimal total = BigDecimal.ZERO;

  @OneToMany(mappedBy = "pengajuan", cascade = CascadeType.ALL)
  List<PengajuanBaris> baris = new ArrayList<>();
}
