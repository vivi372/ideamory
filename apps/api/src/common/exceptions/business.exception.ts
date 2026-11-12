import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * 도메인 비즈니스 로직 및 사용자 인터랙션을 제어하는 전역 베이스 예외 클래스
 * [도메인]_[UX태그]_[상세원인] 포맷의 errorCode를 수용하여 프론트엔드 UI 분기 처리를 지원합니다.
 */
export class BusinessException extends HttpException {
  public readonly errorCode: string;

  /**
   * @param message 사용자 또는 클라이언트에 노출할 에러 메시지
   * @param errorCode [도메인]_[UX태그]_[상세원인] 규격의 에러 코드 (예: MEMO_FIELD_REQUIRED, AUTH_ALERT_UNAUTHORIZED)
   * @param statusCode HTTP 응답 상태 코드 (기본값: 400 Bad Request)
   */
  constructor(
    message: string,
    errorCode: string = "SYSTEM_ERROR_UNKNOWN",
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST
  ) {
    super(
      {
        message,
        errorCode,
        statusCode,
      },
      statusCode
    );
    this.errorCode = errorCode;
  }
}

