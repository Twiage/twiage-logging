describe('globalRequestLogger', () => {
  const mockGlobalRequestLogger = {
    initialize: jest.fn(),
    on: jest.fn(),
  };
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  jest.mock('global-request-logger', () => mockGlobalRequestLogger);
  jest.mock('../logger', () => mockLogger);

  const globalRequestLogger = require('../globalRequestLogger');

  test('initialize', () => {
    // Arrange
    const expectedSuccessEventName = 'success';
    const expectedErrorEventName = 'error';
    // Act
    globalRequestLogger.initialize();
    // Assert
    expect(mockGlobalRequestLogger.initialize).toHaveBeenCalled();
    expect(mockGlobalRequestLogger.on).toHaveBeenCalledWith(expectedSuccessEventName, globalRequestLogger.successCallback);
    expect(mockGlobalRequestLogger.on).toHaveBeenCalledWith(expectedErrorEventName, globalRequestLogger.errorCallback);
  });

  test('successCallback', () => {
    // Arrange
    const expectedRequest = {};
    const expectedTypeName = 'Request';
    // Act
    globalRequestLogger.successCallback(expectedRequest);
    // Assert
    expect(mockLogger.info).toHaveBeenCalledWith(expectedTypeName, expectedRequest);
  });

  test('errorCallback', () => {
    // Arrange
    const expectedRequest = {};
    const expectedTypeName = 'Request';
    // Act
    globalRequestLogger.errorCallback(expectedRequest);
    // Assert
    expect(mockLogger.error).toHaveBeenCalledWith(expectedTypeName, expectedRequest);
  });
});
