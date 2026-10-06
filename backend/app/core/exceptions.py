class AppException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class DatabaseConnectionException(AppException):
    def __init__(self, message: str = "Database connection error"):
        super().__init__(code="INTERNAL_ERROR", message=message, status_code=500)
