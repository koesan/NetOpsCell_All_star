import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof body === "string"
        ? body
        : (body as { message?: string | string[] })?.message || "Beklenmeyen bir hata olustu.";
    const details = typeof body === "object" ? (body as { message?: string[] })?.message : undefined;

    response.status(status).json({
      success: false,
      data: null,
      error: {
        code: HttpStatus[status] || "INTERNAL_ERROR",
        message: Array.isArray(message) ? message.join(", ") : message,
        details: Array.isArray(details) ? details : undefined,
      },
    });
  }
}
