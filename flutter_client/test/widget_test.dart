import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skillcert_web/main.dart';

void main() {
  testWidgets('error state explains the failed operation and offers retry',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: ErrorState(
          message: 'Connection refused',
          onRetry: null,
        ),
      ),
    ));

    expect(find.text('We could not load this data'), findsOneWidget);
    expect(find.text('Connection refused'), findsOneWidget);
  });
}
