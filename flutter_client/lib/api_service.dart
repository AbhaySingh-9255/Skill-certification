import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'download_stub.dart'
    if (dart.library.js_interop) 'download_web.dart';

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;

  @override
  String toString() => message;
}

class ApiService {
  ApiService({http.Client? client})
      : _client = client ?? http.Client(),
        _storage = const FlutterSecureStorage();

  static const _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:5000/api',
  );
  static const _publicWebUrl = String.fromEnvironment(
    'PUBLIC_WEB_URL',
    defaultValue: 'http://localhost:8080',
  );
  static const _tokenKey = 'skillcert.session.token';

  final http.Client _client;
  final FlutterSecureStorage _storage;
  String? _token;

  bool get hasSession => _token != null;

  String get publicWebUrl => _publicWebUrl;
  String get apiBaseUrl => _baseUrl;

  Future<void> restoreSession() async {
    _token = await _storage.read(key: _tokenKey);
  }

  Future<void> saveSession(String token) async {
    _token = token;
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<void> clearSession() async {
    _token = null;
    await _storage.delete(key: _tokenKey);
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) =>
      _send('GET', path, query: query);

  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) =>
      _send('POST', path, body: body);

  Future<Map<String, dynamic>> put(String path, [Map<String, dynamic>? body]) =>
      _send('PUT', path, body: body);

  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? body]) =>
      _send('PATCH', path, body: body);

  Future<void> delete(String path) async {
    await _send('DELETE', path);
  }

  Future<void> downloadCsv(String path, String filename) async {
    final headers = <String, String>{'Accept': 'text/csv'};
    if (_token != null) headers['Authorization'] = 'Bearer $_token';
    final response = await _client.get(Uri.parse('$_baseUrl$path'), headers: headers);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final body = jsonDecode(response.body);
      final error = body is Map ? body['error'] : null;
      final message = error is Map ? error['message'] : null;
      throw ApiException(message is String ? message : 'CSV download failed.', response.statusCode);
    }
    downloadCsvFile(utf8.decode(response.bodyBytes), filename);
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final uri = Uri.parse('$_baseUrl$path').replace(queryParameters: query);
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (_token != null) headers['Authorization'] = 'Bearer $_token';

    late http.Response response;
    try {
      switch (method) {
        case 'GET':
          response = await _client.get(uri, headers: headers);
        case 'POST':
          response = await _client.post(uri, headers: headers, body: jsonEncode(body ?? {}));
        case 'PUT':
          response = await _client.put(uri, headers: headers, body: jsonEncode(body ?? {}));
        case 'PATCH':
          response = await _client.patch(uri, headers: headers, body: jsonEncode(body ?? {}));
        case 'DELETE':
          response = await _client.delete(uri, headers: headers);
        default:
          throw StateError('Unsupported HTTP method: $method');
      }
    } on ApiException {
      rethrow;
    } catch (error) {
      throw ApiException('Could not reach the SkillCert API: $error', 0);
    }

    Map<String, dynamic> decoded = {};
    if (response.body.isNotEmpty) {
      try {
        final value = jsonDecode(response.body);
        if (value is Map<String, dynamic>) decoded = value;
      } on FormatException {
        throw ApiException('The API returned an invalid response.', response.statusCode);
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = decoded['error'];
      final message = error is Map ? error['message'] : null;
      throw ApiException(message is String ? message : 'Request failed (${response.statusCode}).',
          response.statusCode);
    }
    return decoded;
  }
}
