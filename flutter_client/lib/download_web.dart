import 'dart:js_interop';

import 'package:web/web.dart' as web;

void downloadCsvFile(String content, String filename) {
  final blob = web.Blob(
    [content.toJS].toJS,
    web.BlobPropertyBag(type: 'text/csv'),
  );
  final url = web.URL.createObjectURL(blob);
  final link = web.HTMLAnchorElement()
    ..href = url
    ..download = filename;
  link.click();
  web.URL.revokeObjectURL(url);
}
