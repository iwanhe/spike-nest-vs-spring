package id.kcsi.spike.pengajuan;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PengajuanRepository extends JpaRepository<Pengajuan, UUID> {}
