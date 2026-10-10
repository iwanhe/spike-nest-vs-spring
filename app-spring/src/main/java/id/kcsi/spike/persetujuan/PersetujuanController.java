package id.kcsi.spike.persetujuan;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/pengajuan/{id}")
public class PersetujuanController {
  public record Keputusan(String keputusan, String penyetuju) {}

  private final PersetujuanService service;

  public PersetujuanController(PersetujuanService service) {
    this.service = service;
  }

  @PostMapping("/ajukan")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, Boolean> ajukan(@PathVariable UUID id) {
    service.ajukan(id);
    return Map.of("diterima", true);
  }

  @PostMapping("/keputusan")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, Boolean> putuskan(@PathVariable UUID id, @RequestBody Keputusan body) {
    service.putuskan(id, body.keputusan(), body.penyetuju());
    return Map.of("diterima", true);
  }
}
