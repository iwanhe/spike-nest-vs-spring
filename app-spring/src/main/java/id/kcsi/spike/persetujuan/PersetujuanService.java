package id.kcsi.spike.persetujuan;

import java.util.Map;
import java.util.UUID;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PersetujuanService {
  private static final String PROSES = "persetujuanPengajuan";

  private final RuntimeService runtimeService;
  private final TaskService taskService;
  private final HistoryService historyService;

  public PersetujuanService(
      RuntimeService runtimeService, TaskService taskService, HistoryService historyService) {
    this.runtimeService = runtimeService;
    this.taskService = taskService;
    this.historyService = historyService;
  }

  // Id pengajuan dipakai sebagai kunci bisnis, supaya satu pengajuan hanya punya satu proses.
  @Transactional
  public void ajukan(UUID pengajuanId) {
    String kunci = pengajuanId.toString();
    boolean sudahAda =
        historyService.createHistoricProcessInstanceQuery().processInstanceBusinessKey(kunci).count() > 0;
    if (sudahAda) {
      return; // klik ganda: proses sudah berjalan atau sudah selesai
    }
    runtimeService.startProcessInstanceByKey(
        PROSES, kunci, Map.of("pengajuanId", kunci, "batas", batasIso()));
  }

  @Transactional
  public void putuskan(UUID pengajuanId, String keputusan, String penyetuju) {
    Task tugas =
        taskService.createTaskQuery().processInstanceBusinessKey(pengajuanId.toString()).singleResult();
    if (tugas == null) {
      return; // sudah diputuskan atau sudah dieskalasi
    }
    taskService.complete(tugas.getId(), Map.of("keputusan", keputusan, "penyetuju", penyetuju));
  }

  // "5s" menjadi PT5S, "3d" menjadi P3D (format durasi ISO-8601 yang dipakai BPMN).
  static String batasIso() {
    String batas = System.getenv().getOrDefault("BATAS_PERSETUJUAN", "3d").trim().toLowerCase();
    String angka = batas.substring(0, batas.length() - 1);
    return switch (batas.charAt(batas.length() - 1)) {
      case 's' -> "PT" + angka + "S";
      case 'm' -> "PT" + angka + "M";
      case 'h' -> "PT" + angka + "H";
      case 'd' -> "P" + angka + "D";
      default -> throw new IllegalArgumentException("BATAS_PERSETUJUAN tidak dikenal: " + batas);
    };
  }
}
