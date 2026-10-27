export function notFoundHandler(request, response) {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API route does not exist.',
      requestId: request.requestId
    }
  });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = typeof error.code === 'string' ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = status >= 500 ? 'The server could not complete the request.' : error.message;

  if (status >= 500) {
    console.error(`[${request.requestId}]`, error);
  }

  response.status(status).json({
    error: {
      code,
      message,
      requestId: request.requestId
    }
  });
}

