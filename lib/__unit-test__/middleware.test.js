describe('middleware', () => {
  const expectedNamespaceName = 'twiage-logging';
  const expectedUUID = '550e8400-e29b-41d4-a716-446655440000';

  const mockNamespace = {
    bindEmitter: jest.fn(),
    run: jest.fn(),
    set: jest.fn(),
  };

  const mockCLS = {
    createNamespace: jest.fn(() => mockNamespace),
  };
  const mockConfig = {
    get: jest.fn(() => expectedNamespaceName),
  };
  const mockUUID = {
    v4: jest.fn(() => expectedUUID),
  };

  jest.mock('continuation-local-storage', () => mockCLS);
  jest.mock('twiage-config', () => mockConfig);
  jest.mock('uuid', () => mockUUID);

  test('require', () => {
    // Arrange
    const expectedNamespaceConfigPath = 'twiage:logging:namespace';

    // Act
    require('../middleware');

    // Assert
    expect(mockConfig.get).toHaveBeenCalledWith(expectedNamespaceConfigPath);
    expect(mockCLS.createNamespace).toHaveBeenCalledWith(expectedNamespaceName);
  });

  test('spy', () => {
    // Arrange
    const expectedRequest = {};
    const expectedResponse = {};
    const mockNext = jest.fn();
    const middleware = require('../middleware');

    const originalGetRunCallback = middleware.getRunCallback;
    const expectedRunCallback = () => {};
    const mockGetRunCallback = jest.fn(() => expectedRunCallback);
    middleware.getRunCallback = mockGetRunCallback;

    // Act
    middleware.spy(expectedRequest, expectedResponse, mockNext);

    // Assert
    expect(mockNamespace.bindEmitter).toHaveBeenCalledWith(expectedRequest);
    expect(mockNamespace.bindEmitter).toHaveBeenCalledWith(expectedResponse);
    expect(mockGetRunCallback).toHaveBeenCalledWith(expectedRequest, expectedResponse, mockNext);
    expect(mockNamespace.run).toHaveBeenCalledWith(expectedRunCallback);
    middleware.getRunCallback = originalGetRunCallback;
  });

  test('getRunCallback', () => {
    // Arrange
    const expectedRequest = {};
    const expectedResponse = {};
    const mockNext = jest.fn();
    const middleware = require('../middleware');

    // Act
    const actualRunCallback = middleware.getRunCallback(expectedRequest, expectedResponse, mockNext);

    // Assert
    expect(actualRunCallback).toBeInstanceOf(Function);
  });

  test('getRunCallback - run callback', () => {
    // Arrange
    const expectedRequest = {};
    const expectedResponse = {};
    const mockNext = jest.fn();
    const middleware = require('../middleware');
    const expectedRequestVariableName = 'request';
    const expectedResponseVariableName = 'response';
    const expectedUUIDVariableName = 'uuid';
    const actualRunCallback = middleware.getRunCallback(expectedRequest, expectedResponse, mockNext);

    // Act
    actualRunCallback();

    // Assert
    expect(mockNamespace.set).toHaveBeenCalledWith(expectedRequestVariableName, expectedRequest);
    expect(mockNamespace.set).toHaveBeenCalledWith(expectedResponseVariableName, expectedResponse);
    expect(mockNamespace.set).toHaveBeenCalledWith(expectedUUIDVariableName, expectedUUID);
    expect(mockNext).toHaveBeenCalled();
  });
});
