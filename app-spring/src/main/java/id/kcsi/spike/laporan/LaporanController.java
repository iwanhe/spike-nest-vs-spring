package id.kcsi.spike.laporan;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/laporan")
public class LaporanController {
  private final JdbcTemplate jdbc;

  public LaporanController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  // Yang berat dikerjakan PostgreSQL; aplikasi hanya menunggu hasilnya.
  @GetMapping("/rekap")
  public List<Map<String, Object>> rekap() {
    return jdbc.queryForList(
        """
        SELECT to_char(date_trunc('month', dibuat_pada AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM') AS bulan,
               pemasok, count(*)::int AS jumlah_pengajuan, sum(total)::text AS total
          FROM pengajuan
         WHERE status = 'DISETUJUI'
         GROUP BY 1, 2
         ORDER BY 1, 2
        """);
  }
}
