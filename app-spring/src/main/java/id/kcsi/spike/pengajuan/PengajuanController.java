package id.kcsi.spike.pengajuan;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/pengajuan")
public class PengajuanController {
  private final PengajuanService service;

  public PengajuanController(PengajuanService service) {
    this.service = service;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PengajuanView buat(
      @RequestBody BuatPengajuan dto,
      @RequestHeader(name = "x-uji-gagal", required = false) String ujiGagal) {
    return service.buat(dto, ujiGagal);
  }

  @GetMapping("/{id}")
  public PengajuanView cari(@PathVariable UUID id) {
    return service.cari(id);
  }
}
