import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { StationsService } from "./stations.service";

/** Baz istasyonu katalogu — tum kimlik dogrulanmis roller okuyabilir
 * (musteri ariza bildirirken istasyon secer, operasyon ekranlari haritada gosterir). */
@ApiTags("stations")
@Controller("stations")
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  findAll() {
    return this.stationsService.findAll();
  }
}
