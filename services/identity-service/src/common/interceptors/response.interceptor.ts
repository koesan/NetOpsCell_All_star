import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";

// Tum servislerde ortak standart response zarfi: { success, data, error } (bkz. ARCHITECTURE.md Bolum 6)
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === "object" && "success" in data) {
          return data; // health-check gibi zaten zarflanmis yanitlar tekrar sarilmaz
        }
        return { success: true, data: data ?? null, error: null };
      })
    );
  }
}
