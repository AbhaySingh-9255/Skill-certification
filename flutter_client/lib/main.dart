import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_service.dart';

const _ink = Color(0xFF172C3D);
const _teal = Color(0xFF087F75);
const _canvas = Color(0xFFF4F7F6);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SkillCertApp());
}

class SkillCertApp extends StatelessWidget {
  const SkillCertApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'SkillCert',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          scaffoldBackgroundColor: _canvas,
          colorScheme: ColorScheme.fromSeed(seedColor: _teal, surface: Colors.white),
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.white,
            foregroundColor: _ink,
            elevation: 0,
            centerTitle: false,
          ),
          cardTheme: CardThemeData(
            color: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: const BorderSide(color: Color(0xFFE5ECE9)),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: const Color(0xFFF7F9F8),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFDCE5E1)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFDCE5E1)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _teal, width: 1.5),
            ),
          ),
          filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
              backgroundColor: _teal,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
        home: const AppRoot(),
      );
}

class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  final _api = ApiService();
  Map<String, dynamic>? _user;
  bool _loading = true;
  String? _publicCertificate;

  @override
  void initState() {
    super.initState();
    final segments = Uri.base.pathSegments;
    if (segments.length >= 2 && segments[0] == 'verify') {
      _publicCertificate = segments[1];
    }
    _restore();
  }

  Future<void> _restore() async {
    try {
      await _api.restoreSession();
      if (_api.hasSession) {
        _user = await _api.get('/auth/me');
      }
    } on ApiException catch (error) {
      if (error.statusCode == 401) await _api.clearSession();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signedIn(Map<String, dynamic> user) async {
    setState(() {
      _user = user;
      _loading = false;
    });
  }

  Future<void> _signOut() async {
    try {
      await _api.post('/auth/logout');
    } on ApiException {
      // The token is removed locally even if the API is unreachable.
    }
    await _api.clearSession();
    if (mounted) setState(() => _user = null);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_publicCertificate != null) {
      return PublicVerificationPage(api: _api, certificateId: _publicCertificate!);
    }
    if (_user == null) {
      return AuthPage(api: _api, onSignedIn: _signedIn);
    }
    return Workspace(
      api: _api,
      user: _user!,
      onSignOut: _signOut,
      onProfileUpdated: (user) => setState(() => _user = user),
    );
  }
}

class AuthPage extends StatefulWidget {
  const AuthPage({required this.api, required this.onSignedIn, super.key});
  final ApiService api;
  final ValueChanged<Map<String, dynamic>> onSignedIn;

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _registering = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await widget.api.post(
        _registering ? '/auth/register' : '/auth/login',
        {
          if (_registering) 'name': _name.text.trim(),
          'email': _email.text.trim(),
          'password': _password.text,
        },
      );
      await widget.api.saveSession(response['token'] as String);
      widget.onSignedIn(response);
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 780;
    return Scaffold(
      body: Row(
        children: [
          if (wide)
            Expanded(
              child: Container(
                color: _ink,
                padding: const EdgeInsets.all(56),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Brand(dark: true),
                    const SizedBox(height: 58),
                    Text(
                      'Skills worth\nproving.',
                      style: Theme.of(context).textTheme.displayMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            height: 1.07,
                          ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'A focused place to test your knowledge, track your progress, and earn credentials that travel with you.',
                      style: TextStyle(color: Color(0xFFC6D5D4), height: 1.7, fontSize: 16),
                    ),
                    const SizedBox(height: 42),
                    const _FeatureLine(icon: Icons.verified_outlined, label: 'Verified achievements'),
                    const _FeatureLine(icon: Icons.insights_outlined, label: 'Progress built on real results'),
                    const _FeatureLine(icon: Icons.timer_outlined, label: 'Thoughtful, timed assessments'),
                  ],
                ),
              ),
            ),
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Form(
                    key: _form,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (!wide) const Brand(),
                        Text(_registering ? 'Create your account' : 'Welcome back',
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                  color: _ink,
                                  fontWeight: FontWeight.w700,
                                )),
                        const SizedBox(height: 8),
                        Text(_registering
                            ? 'Start building a record of what you know.'
                            : 'Sign in to continue your learning journey.'),
                        const SizedBox(height: 28),
                        if (_registering) ...[
                          TextFormField(
                            controller: _name,
                            decoration: const InputDecoration(labelText: 'Full name'),
                            validator: (value) => value == null || value.trim().isEmpty
                                ? 'Enter your name'
                                : null,
                          ),
                          const SizedBox(height: 14),
                        ],
                        TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          decoration: const InputDecoration(labelText: 'Email'),
                          validator: (value) =>
                              value == null || !value.contains('@') ? 'Enter a valid email' : null,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _password,
                          obscureText: true,
                          autofillHints: [
                            _registering ? AutofillHints.newPassword : AutofillHints.password,
                          ],
                          decoration: const InputDecoration(labelText: 'Password'),
                          validator: (value) => value == null ||
                                  value.length < (_registering ? 12 : 1)
                              ? _registering
                                  ? 'Use at least 12 characters'
                                  : 'Enter your password'
                              : null,
                          onFieldSubmitted: (_) => _submit(),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 14),
                          ErrorBanner(message: _error!),
                        ],
                        const SizedBox(height: 22),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _busy ? null : _submit,
                            child: _busy
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : Text(_registering ? 'Create account' : 'Sign in'),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Center(
                          child: TextButton(
                            onPressed: _busy
                                ? null
                                : () => setState(() {
                                      _registering = !_registering;
                                      _error = null;
                                    }),
                            child: Text(_registering
                                ? 'Already have an account? Sign in'
                                : 'New to SkillCert? Create an account'),
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Assessment timing and scoring are enforced by the server. Browser-based tools cannot guarantee prevention of outside assistance.',
                          style: TextStyle(fontSize: 12, color: Color(0xFF64736F), height: 1.5),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class Workspace extends StatefulWidget {
  const Workspace({
    required this.api,
    required this.user,
    required this.onSignOut,
    required this.onProfileUpdated,
    super.key,
  });
  final ApiService api;
  final Map<String, dynamic> user;
  final Future<void> Function() onSignOut;
  final ValueChanged<Map<String, dynamic>> onProfileUpdated;

  @override
  State<Workspace> createState() => _WorkspaceState();
}

class _WorkspaceState extends State<Workspace> {
  int _selected = 0;
  final _search = TextEditingController();
  String? _searchValue;
  int _refreshKey = 0;

  List<_NavEntry> get _navigation {
    final entries = <_NavEntry>[
      const _NavEntry('Overview', Icons.space_dashboard_outlined),
      const _NavEntry('Assessments', Icons.menu_book_outlined),
      const _NavEntry('My results', Icons.query_stats_outlined),
      const _NavEntry('Certificates', Icons.workspace_premium_outlined),
    ];
    if (widget.user['role'] == 'instructor' || widget.user['role'] == 'admin') {
      entries.add(const _NavEntry('Manage', Icons.tune_outlined));
    }
    if (widget.user['role'] == 'admin') {
      entries.add(const _NavEntry('Administration', Icons.admin_panel_settings_outlined));
    }
    entries.add(const _NavEntry('Verify certificate', Icons.verified_user_outlined));
    return entries;
  }

  Future<void> _refresh() async => setState(() => _refreshKey++);

  Future<void> _editProfile() async {
    final name = TextEditingController(text: widget.user['name'] as String? ?? '');
    final email = TextEditingController(text: widget.user['email'] as String? ?? '');
    final form = GlobalKey<FormState>();
    final save = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Your profile'),
        content: Form(
          key: form,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextFormField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Name'),
              validator: (value) => value == null || value.trim().isEmpty ? 'Name required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: email,
              decoration: const InputDecoration(labelText: 'Email'),
              validator: (value) =>
                  value == null || !value.contains('@') ? 'Enter a valid email' : null,
            ),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () {
            if (form.currentState!.validate()) Navigator.pop(context, true);
          }, child: const Text('Save')),
        ],
      ),
    );
    if (save != true) return;
    try {
      final user = await widget.api.put('/profile', {'name': name.text, 'email': email.text});
      widget.onProfileUpdated(user);
      if (mounted) _message('Profile updated.');
    } on ApiException catch (error) {
      if (mounted) _message(error.message, error: true);
    }
  }

  Future<void> _changePassword() async {
    final current = TextEditingController();
    final next = TextEditingController();
    final confirmation = TextEditingController();
    final form = GlobalKey<FormState>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Change password'),
        content: Form(
          key: form,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextFormField(
              controller: current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current password'),
              validator: (value) => value == null || value.isEmpty
                  ? 'Enter your current password'
                  : null,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: next,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New password'),
              validator: (value) => value == null || value.length < 12
                  ? 'Use at least 12 characters'
                  : null,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: confirmation,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirm new password'),
              validator: (value) =>
                  value != next.text ? 'Passwords do not match' : null,
            ),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (form.currentState!.validate()) Navigator.pop(context, true);
            },
            child: const Text('Update password'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      current.dispose();
      next.dispose();
      confirmation.dispose();
      return;
    }
    try {
      await widget.api.post('/auth/change-password', {
        'current_password': current.text,
        'new_password': next.text,
      });
      if (mounted) {
        _message('Password updated. Please sign in again.');
        await widget.onSignOut();
      }
    } on ApiException catch (error) {
      if (mounted) _message(error.message, error: true);
    } finally {
      current.dispose();
      next.dispose();
      confirmation.dispose();
    }
  }

  void _message(String message, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? const Color(0xFFAB3535) : _ink,
    ));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final nav = _navigation;
    if (_selected >= nav.length) _selected = 0;
    final wide = MediaQuery.sizeOf(context).width >= 960;
    final title = nav[_selected].label;
    Widget content;
    switch (title) {
      case 'Overview':
        content = DashboardView(
          key: ValueKey('dashboard-$_refreshKey'),
          api: widget.api,
          onOpenCatalog: () => setState(() => _selected = 1),
          onResume: (attempt) => _takeAttempt(attempt['assessment_id'] as int,
              existingAttemptId: attempt['id'] as int),
        );
      case 'Assessments':
        content = CatalogView(
          key: ValueKey('catalog-$_refreshKey'),
          api: widget.api,
          search: _searchValue,
          onStart: (id, {attemptId}) => _takeAttempt(id, existingAttemptId: attemptId),
        );
      case 'My results':
        content = ResultsView(key: ValueKey('results-$_refreshKey'), api: widget.api);
      case 'Certificates':
        content = CertificatesView(
          key: ValueKey('certificates-$_refreshKey'),
          api: widget.api,
        );
      case 'Manage':
        content = ManageView(
          key: ValueKey('manage-$_refreshKey'),
          api: widget.api,
          onChanged: _refresh,
        );
      case 'Administration':
        content = AdminView(key: ValueKey('admin-$_refreshKey'), api: widget.api);
      default:
        content = VerifyView(key: ValueKey('verify-$_refreshKey'), api: widget.api);
    }
    return Scaffold(
      appBar: AppBar(
        title: wide
            ? Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: _ink))
            : const Brand(),
        actions: [
          if (wide && _selected == 1)
            SizedBox(
              width: 220,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: TextField(
                  controller: _search,
                  decoration: const InputDecoration(
                    hintText: 'Search skills',
                    prefixIcon: Icon(Icons.search, size: 20),
                    contentPadding: EdgeInsets.symmetric(vertical: 8),
                  ),
                  onSubmitted: (value) {
                    setState(() {
                      _searchValue = value.trim();
                      _refreshKey++;
                    });
                  },
                ),
              ),
            ),
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => NotificationsDialog(api: widget.api),
            ),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          PopupMenuButton<String>(
            tooltip: 'Profile menu',
            onSelected: (value) {
              if (value == 'profile') _editProfile();
              if (value == 'password') _changePassword();
              if (value == 'logout') widget.onSignOut();
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'profile',
                child: Text('${widget.user['name']} · Profile'),
              ),
              const PopupMenuItem(value: 'password', child: Text('Change password')),
              const PopupMenuItem(value: 'logout', child: Text('Sign out')),
            ],
            child: Padding(
              padding: const EdgeInsets.only(left: 8, right: 18),
              child: CircleAvatar(
                backgroundColor: const Color(0xFFE1F3EF),
                foregroundColor: _teal,
                child: Text((widget.user['name'] as String? ?? 'S').characters.first.toUpperCase()),
              ),
            ),
          ),
        ],
      ),
      drawer: wide
          ? null
          : Drawer(
              child: SafeArea(
                child: Column(
                  children: [
                    const Padding(padding: EdgeInsets.all(20), child: Brand()),
                    Expanded(child: _NavList(entries: nav, selected: _selected, onSelect: (v) {
                      setState(() => _selected = v);
                      Navigator.pop(context);
                    })),
                    ListTile(
                      leading: const Icon(Icons.logout),
                      title: const Text('Sign out'),
                      onTap: widget.onSignOut,
                    ),
                  ],
                ),
              ),
            ),
      body: Row(
        children: [
          if (wide)
            Container(
              width: 238,
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(padding: EdgeInsets.fromLTRB(24, 24, 20, 32), child: Brand()),
                  _NavList(entries: nav, selected: _selected, onSelect: (value) {
                    setState(() {
                      _selected = value;
                      _searchValue = null;
                      _search.clear();
                    });
                  }),
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.all(18),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF2F7F5),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(children: [
                        const Icon(Icons.shield_outlined, color: _teal),
                        const SizedBox(width: 10),
                        Expanded(child: Text(
                          'Signed in as ${widget.user['role']}',
                          style: const TextStyle(fontSize: 12, color: _ink),
                        )),
                      ]),
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.logout),
                    title: const Text('Sign out'),
                    onTap: widget.onSignOut,
                  ),
                ],
              ),
            ),
          Expanded(
            child: Column(
              children: [
                if (!wide && _selected == 1)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                    child: TextField(
                      controller: _search,
                      decoration: const InputDecoration(
                        hintText: 'Search assessments',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onSubmitted: (value) => setState(() {
                        _searchValue = value.trim();
                        _refreshKey++;
                      }),
                    ),
                  ),
                Expanded(child: content),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: _selected,
              onDestinationSelected: (value) => setState(() => _selected = value),
              destinations: nav.take(4).map((entry) => NavigationDestination(
                    icon: Icon(entry.icon),
                    label: entry.label == 'Assessments' ? 'Explore' : entry.label.replaceAll('My ', ''),
                  )).toList(),
            ),
    );
  }

  Future<void> _takeAttempt(int assessmentId, {int? existingAttemptId}) async {
    try {
      final assessment = await widget.api.get('/assessments/$assessmentId');
      if (!mounted) return;
      final start = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(assessment['title'] as String? ?? 'Assessment'),
          content: Text(
            '${assessment['instructions'] ?? assessment['description'] ?? 'Read each question carefully.'}\n\n'
            '${assessment['duration_minutes']} minutes · ${assessment['question_count']} questions · '
            'Pass ${assessment['pass_percent']}%\n\n'
            'The API controls the deadline and records your answers as you go.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Not now')),
            FilledButton(onPressed: () => Navigator.pop(context, true),
                child: Text(existingAttemptId == null ? 'Start assessment' : 'Resume assessment')),
          ],
        ),
      );
      if (start != true || !mounted) return;
      final started = existingAttemptId == null
          ? await widget.api.post('/assessments/$assessmentId/attempts')
          : {'id': existingAttemptId};
      final attempt = await widget.api.get('/attempts/${started['id']}');
      if (!mounted) return;
      if (attempt['status'] != null && attempt['status'] != 'in_progress') {
        setState(() {
          _selected = 2;
          _refreshKey++;
        });
        _message('The assessment deadline passed. Its result is available in your history.');
        return;
      }
      final result = await Navigator.of(context).push<Map<String, dynamic>>(
        MaterialPageRoute(
          builder: (_) => AssessmentPage(api: widget.api, attempt: attempt),
        ),
      );
      if (result != null && mounted) {
        setState(() {
          _selected = 2;
          _refreshKey++;
        });
      }
    } on ApiException catch (error) {
      if (mounted) _message(error.message, error: true);
    }
  }
}

class DashboardView extends StatelessWidget {
  const DashboardView({
    required this.api,
    required this.onOpenCatalog,
    required this.onResume,
    super.key,
  });
  final ApiService api;
  final VoidCallback onOpenCatalog;
  final ValueChanged<Map<String, dynamic>> onResume;

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
        future: api.get('/dashboard'),
        builder: (context, snapshot) {
          if (snapshot.hasError) return ErrorState(message: snapshot.error.toString());
          if (!snapshot.hasData) return const LoadingState();
          final dashboard = snapshot.data!;
          final metrics = dashboard['metrics'] as Map<String, dynamic>? ?? {};
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                runSpacing: 16,
                children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Your learning, in focus',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              color: _ink, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    const Text('A clear view of your progress and what to explore next.'),
                  ]),
                  OutlinedButton.icon(
                    onPressed: onOpenCatalog,
                    icon: const Icon(Icons.explore_outlined),
                    label: const Text('Explore assessments'),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 14,
                runSpacing: 14,
                children: [
                  _MetricCard(label: 'Assessments taken', value: '${metrics['total'] ?? 0}',
                      icon: Icons.fact_check_outlined, color: const Color(0xFF298578)),
                  _MetricCard(label: 'Average score', value: '${_format(metrics['average'])}%',
                      icon: Icons.trending_up, color: const Color(0xFF4B71AE)),
                  _MetricCard(label: 'Pass rate', value: '${_format(metrics['pass_rate'])}%',
                      icon: Icons.track_changes, color: const Color(0xFFAB7B38)),
                  _MetricCard(label: 'Certificates', value: '${metrics['certificates'] ?? 0}',
                      icon: Icons.workspace_premium_outlined, color: const Color(0xFF8060A9)),
                ],
              ),
              const SizedBox(height: 18),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Score progress',
                          style: TextStyle(color: _ink, fontWeight: FontWeight.w700, fontSize: 17)),
                      const SizedBox(height: 4),
                      const Text('Your latest submitted attempts · score percentage',
                          style: TextStyle(color: Colors.blueGrey, fontSize: 12)),
                      const SizedBox(height: 12),
                      ProgressChart(
                        values: (dashboard['score_progress'] as List<dynamic>? ?? [])
                            .map((value) => (value as Map<String, dynamic>)['score_percent'])
                            .whereType<num>()
                            .map((value) => value.toDouble())
                            .toList(),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 22),
              FutureBuilder<Map<String, dynamic>>(
                future: api.get('/attempts/active'),
                builder: (context, active) {
                  final items = active.data?['items'] as List<dynamic>? ?? [];
                  if (items.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionHeading('Continue where you left off'),
                      ...items.map((item) {
                        final attempt = item as Map<String, dynamic>;
                        return Card(
                          child: ListTile(
                            leading: const Icon(Icons.timer_outlined, color: _teal),
                            title: Text(attempt['title'] as String? ?? 'Assessment'),
                            subtitle: const Text('In progress · answers are saved automatically'),
                            trailing: FilledButton(
                              onPressed: () => onResume(attempt),
                              child: const Text('Resume'),
                            ),
                          ),
                        );
                      }),
                      const SizedBox(height: 18),
                    ],
                  );
                },
              ),
              SectionHeading('Recent activity',
                  trailing: TextButton(onPressed: onOpenCatalog, child: const Text('Find your next test'))),
              if ((dashboard['recent_activity'] as List<dynamic>? ?? []).isEmpty)
                const EmptyState(
                  icon: Icons.auto_awesome_outlined,
                  title: 'Your next milestone starts here',
                  message: 'Complete an assessment and your results will appear in this activity feed.',
                )
              else
                ...((dashboard['recent_activity'] as List<dynamic>).map((raw) {
                  final item = raw as Map<String, dynamic>;
                  return Card(
                    child: ListTile(
                      leading: Icon(
                        item['passed'] == true ? Icons.check_circle_outline : Icons.history,
                        color: item['passed'] == true ? _teal : Colors.blueGrey,
                      ),
                      title: Text(item['title'] as String? ?? 'Assessment'),
                      subtitle: Text('${item['status']} · ${item['submitted_at'] ?? ''}'),
                      trailing: Text('${_format(item['score_percent'])}%',
                          style: const TextStyle(fontWeight: FontWeight.w700, color: _ink)),
                    ),
                  );
                })),
              const SizedBox(height: 18),
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline, color: _teal),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Assessment time limits and scores are enforced by the API. Browser-based measures cannot guarantee prevention of outside assistance.',
                          style: TextStyle(height: 1.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
}

class CatalogView extends StatefulWidget {
  const CatalogView({
    required this.api,
    required this.onStart,
    this.search,
    super.key,
  });
  final ApiService api;
  final String? search;
  final void Function(int id, {int? attemptId}) onStart;

  @override
  State<CatalogView> createState() => _CatalogViewState();
}

class _CatalogViewState extends State<CatalogView> {
  String? _category;
  String? _difficulty;
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    final query = <String, String>{'page': '$_page', 'per_page': '9'};
    if (widget.search?.isNotEmpty == true) query['search'] = widget.search!;
    if (_category != null) query['category'] = _category!;
    if (_difficulty != null) query['difficulty'] = _difficulty!;
    return FutureBuilder<Map<String, dynamic>>(
      future: Future.wait([
        widget.api.get('/assessments', query: query),
        widget.api.get('/categories'),
      ]).then((values) => {'catalog': values[0], 'categories': values[1]}),
      builder: (context, snapshot) {
        if (snapshot.hasError) return ErrorState(message: snapshot.error.toString());
        if (!snapshot.hasData) return const LoadingState();
        final data = snapshot.data!;
        final catalog = data['catalog'] as Map<String, dynamic>;
        final items = catalog['items'] as List<dynamic>? ?? [];
        final categories = (data['categories']['items'] as List<dynamic>? ?? [])
            .map((value) => value.toString()).toList();
        final total = catalog['total'] as int? ?? 0;
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text('Explore assessments',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: _ink, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            const Text('Choose a focused assessment and see the format before you begin.'),
            const SizedBox(height: 20),
            Wrap(
              spacing: 12,
              runSpacing: 10,
              children: [
                SizedBox(
                  width: 220,
                  child: DropdownButtonFormField<String?>(
                    initialValue: _category,
                    decoration: const InputDecoration(labelText: 'Category'),
                    items: [
                      const DropdownMenuItem<String?>(value: null, child: Text('All categories')),
                      ...categories.map((value) => DropdownMenuItem(value: value, child: Text(value))),
                    ],
                    onChanged: (value) => setState(() {
                      _category = value;
                      _page = 1;
                    }),
                  ),
                ),
                SizedBox(
                  width: 220,
                  child: DropdownButtonFormField<String?>(
                    initialValue: _difficulty,
                    decoration: const InputDecoration(labelText: 'Difficulty'),
                    items: const [
                      DropdownMenuItem<String?>(value: null, child: Text('All levels')),
                      DropdownMenuItem(value: 'Beginner', child: Text('Beginner')),
                      DropdownMenuItem(value: 'Intermediate', child: Text('Intermediate')),
                      DropdownMenuItem(value: 'Advanced', child: Text('Advanced')),
                    ],
                    onChanged: (value) => setState(() {
                      _difficulty = value;
                      _page = 1;
                    }),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (items.isEmpty)
              const EmptyState(
                icon: Icons.search_off_outlined,
                title: 'No assessments found',
                message: 'Try another search or filter. New published assessments will appear here.',
              )
            else
              LayoutBuilder(builder: (context, constraints) {
                final width = constraints.maxWidth;
                final count = width > 1000 ? 3 : width > 640 ? 2 : 1;
                const gap = 14.0;
                final cardWidth = (width - gap * (count - 1)) / count;
                return Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: items.map((raw) {
                    final assessment = raw as Map<String, dynamic>;
                    return SizedBox(
                      width: cardWidth,
                      child: AssessmentCard(
                        assessment: assessment,
                        onStart: () => widget.onStart(assessment['id'] as int),
                      ),
                    );
                  }).toList(),
                );
              }),
            if (total > 9)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    onPressed: _page > 1 ? () => setState(() => _page--) : null,
                    icon: const Icon(Icons.chevron_left),
                  ),
                  Text('Page $_page of ${(total / 9).ceil()}'),
                  IconButton(
                    onPressed: _page * 9 < total ? () => setState(() => _page++) : null,
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
          ],
        );
      },
    );
  }
}

class AssessmentCard extends StatelessWidget {
  const AssessmentCard({required this.assessment, required this.onStart, super.key});
  final Map<String, dynamic> assessment;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) => Card(
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Tag(label: assessment['category'] as String? ?? 'Skills'),
                  const Spacer(),
                  Text(assessment['difficulty'] as String? ?? '',
                      style: const TextStyle(color: Color(0xFF5A6C67), fontSize: 12)),
                ],
              ),
              const SizedBox(height: 18),
              Text(assessment['title'] as String? ?? 'Assessment',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: _ink)),
              const SizedBox(height: 8),
              Text(
                assessment['description'] as String? ?? '',
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(height: 1.5, color: Color(0xFF566762)),
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 14,
                runSpacing: 8,
                children: [
                  _InfoPill(Icons.timer_outlined, '${assessment['duration_minutes']} min'),
                  _InfoPill(Icons.quiz_outlined, '${assessment['question_count']} questions'),
                  _InfoPill(Icons.flag_outlined, 'Pass ${assessment['pass_percent']}%'),
                ],
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: onStart,
                  icon: const Icon(Icons.arrow_forward, size: 18),
                  label: const Text('View instructions'),
                ),
              ),
            ],
          ),
        ),
      );
}

class AssessmentPage extends StatefulWidget {
  const AssessmentPage({required this.api, required this.attempt, super.key});
  final ApiService api;
  final Map<String, dynamic> attempt;

  @override
  State<AssessmentPage> createState() => _AssessmentPageState();
}

class _AssessmentPageState extends State<AssessmentPage> {
  late Map<String, dynamic> _attempt = widget.attempt;
  int _index = 0;
  final Set<int> _review = {};
  bool _busy = false;
  bool _loading = true;
  bool _submitted = false;
  String? _error;
  Timer? _clock;
  int _remaining = 0;
  bool _clockStarted = false;

  List<dynamic> get _questions => _attempt['questions'] as List<dynamic>? ?? [];
  Map<String, dynamic> get _current => _questions[_index] as Map<String, dynamic>;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      if (_attempt['questions'] == null) {
        _attempt = await widget.api.get('/attempts/${_attempt['id']}');
      }
      if (_attempt['status'] != null && _attempt['status'] != 'in_progress') {
        _submitted = true;
      }
      _updateClock();
      _clock = Timer.periodic(const Duration(seconds: 1), (_) {
        if (_remaining > 0) {
          setState(() => _remaining--);
        }
        if (_remaining <= 0 && !_submitted && !_busy) _submit(automatic: true);
      });
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _updateClock() {
    if (_clockStarted) return;
    final deadline = (_attempt['deadline_at'] as num?)?.toDouble();
    final serverTime = (_attempt['server_time'] as num?)?.toDouble();
    if (deadline == null) return;
    _clockStarted = true;
    _remaining = (deadline - (serverTime ?? deadline)).ceil().clamp(0, 10000000);
    if (mounted) setState(() {});
  }

  Future<void> _answer(dynamic value) async {
    final question = _current;
    try {
      await widget.api.put('/attempts/${_attempt['id']}/responses', {
        'question_id': question['id'],
        'answer': value,
      });
      setState(() => question['answer'] = value);
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    }
  }

  Future<void> _submit({bool automatic = false}) async {
    if (_busy || _submitted) return;
    if (!automatic) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Submit assessment?'),
          content: Text('$_answered of ${_questions.length} questions answered. You cannot change your answers after submission.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Continue assessment')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Submit now')),
          ],
        ),
      );
      if (confirm != true) return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.api.post('/attempts/${_attempt['id']}/submit');
      if (!mounted) return;
      _submitted = true;
      _clock?.cancel();
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          icon: Icon(result['passed'] == true ? Icons.verified_outlined : Icons.assignment_turned_in_outlined,
              color: result['passed'] == true ? _teal : Colors.blueGrey, size: 44),
          title: Text(result['passed'] == true ? 'Assessment passed' : 'Assessment submitted'),
          content: Text(
            'Server-calculated score: ${_format(result['score_percent'])}%\n'
            'Correct ${result['correct_count'] ?? 0} · Incorrect ${result['incorrect_count'] ?? 0} · '
            'Unanswered ${result['unanswered_count'] ?? 0}'
            '${automatic ? '\nThe server deadline was reached.' : ''}'
            '${result['certificate_id'] == null ? '' : '\nCertificate: ${result['certificate_id']}'}',
          ),
          actions: [FilledButton(onPressed: () => Navigator.pop(context), child: const Text('View results'))],
        ),
      );
      if (mounted) Navigator.pop(context, result);
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  int get _answered => _questions.where((raw) {
        final question = raw as Map<String, dynamic>;
        return question['answer'] != null;
      }).length;

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingState());
    if (_error != null && _questions.isEmpty) {
      return Scaffold(body: ErrorState(message: _error!, onRetry: _initialize));
    }
    if (_questions.isEmpty) {
      return const Scaffold(body: ErrorState(message: 'This assessment has no questions.'));
    }
    final question = _current;
    final duration = (_attempt['deadline_at'] as num?)?.toDouble();
    final width = MediaQuery.sizeOf(context).width;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Exit assessment',
          icon: const Icon(Icons.close),
          onPressed: () async {
            final navigator = Navigator.of(context);
            final exit = await showDialog<bool>(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('Leave assessment?'),
                content: const Text('Your saved answers remain on the server. You can resume before the deadline.'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Stay')),
                  FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Leave')),
                ],
              ),
            );
            if (exit == true && navigator.mounted) navigator.pop();
          },
        ),
        title: Text(_attempt['title'] as String? ?? 'Assessment',
            style: const TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 20),
            child: Chip(
              avatar: const Icon(Icons.timer_outlined, size: 18),
              label: Text('${_remaining ~/ 60}:${(_remaining % 60).toString().padLeft(2, '0')}',
                  style: TextStyle(color: _remaining < 60 ? Colors.red : _ink)),
              backgroundColor: _remaining < 60 ? const Color(0xFFFFE9E7) : const Color(0xFFE5F3F0),
            ),
          ),
        ],
      ),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1080),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: width < 790
                ? Column(
                    children: [
                      _QuestionNavigation(
                        questions: _questions,
                        index: _index,
                        review: _review,
                        onSelect: (value) => setState(() => _index = value),
                      ),
                      const SizedBox(height: 12),
                      Expanded(child: _QuestionCard(
                        question: question, index: _index, total: _questions.length,
                        onAnswer: _answer, onPrevious: () => setState(() => _index--),
                        onNext: () => setState(() => _index++),
                        onReview: () => setState(() {
                          _review.contains(question['id'])
                              ? _review.remove(question['id'])
                              : _review.add(question['id'] as int);
                        }),
                        isReview: _review.contains(question['id']),
                        canPrevious: _index > 0, canNext: _index < _questions.length - 1,
                        onSubmit: () => _submit(),
                        busy: _busy, error: _error,
                      )),
                    ],
                  )
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 230,
                        child: _QuestionNavigation(
                          questions: _questions,
                          index: _index,
                          review: _review,
                          onSelect: (value) => setState(() => _index = value),
                        ),
                      ),
                      const SizedBox(width: 18),
                      Expanded(
                        child: _QuestionCard(
                          question: question, index: _index, total: _questions.length,
                          onAnswer: _answer, onPrevious: () => setState(() => _index--),
                          onNext: () => setState(() => _index++),
                          onReview: () => setState(() {
                            _review.contains(question['id'])
                                ? _review.remove(question['id'])
                                : _review.add(question['id'] as int);
                          }),
                          isReview: _review.contains(question['id']),
                          canPrevious: _index > 0, canNext: _index < _questions.length - 1,
                          onSubmit: () => _submit(), busy: _busy, error: _error,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
      bottomNavigationBar: duration == null
          ? null
          : Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: SafeArea(
                child: Row(
                  children: [
                    Expanded(
                      child: LinearProgressIndicator(
                        value: _answered / _questions.length,
                        minHeight: 6,
                        borderRadius: BorderRadius.circular(6),
                        backgroundColor: const Color(0xFFE4EBE8),
                        color: _teal,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text('$_answered/${_questions.length}'),
                  ],
                ),
              ),
            ),
    );
  }
}

class _QuestionNavigation extends StatelessWidget {
  const _QuestionNavigation({
    required this.questions,
    required this.index,
    required this.review,
    required this.onSelect,
  });
  final List<dynamic> questions;
  final int index;
  final Set<int> review;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Questions · ${questions.length}',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: _ink)),
              const SizedBox(height: 6),
              const Text('Tap a number to move between questions.',
                  style: TextStyle(fontSize: 12, color: Colors.blueGrey)),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: List.generate(questions.length, (i) {
                  final q = questions[i] as Map<String, dynamic>;
                  final active = i == index;
                  final answered = q['answer'] != null;
                  return Tooltip(
                    message: 'Question ${i + 1}${answered ? ', answered' : ', unanswered'}'
                        '${review.contains(q['id']) ? ', marked for review' : ''}',
                    child: InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => onSelect(i),
                      child: Container(
                        width: 38,
                        height: 38,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: active
                              ? _teal
                              : answered
                                  ? const Color(0xFFE1F3EF)
                                  : Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: active
                                ? _teal
                                : review.contains(q['id'])
                                    ? const Color(0xFFBC8732)
                                    : const Color(0xFFDCE5E1),
                            width: review.contains(q['id']) ? 2 : 1,
                          ),
                        ),
                        child: Text('${i + 1}',
                            style: TextStyle(
                              color: active ? Colors.white : _ink,
                              fontWeight: FontWeight.w600,
                            )),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 14),
              const _Legend(color: Color(0xFF087F75), label: 'Current'),
              const _Legend(color: Color(0xFFE1F3EF), label: 'Answered'),
              const _Legend(color: Colors.white, label: 'Unanswered'),
              const _Legend(color: Color(0xFFFFF5DB), label: 'Review'),
            ],
          ),
        ),
      );
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.question,
    required this.index,
    required this.total,
    required this.onAnswer,
    required this.onPrevious,
    required this.onNext,
    required this.onReview,
    required this.isReview,
    required this.canPrevious,
    required this.canNext,
    required this.onSubmit,
    required this.busy,
    required this.error,
  });
  final Map<String, dynamic> question;
  final int index;
  final int total;
  final ValueChanged<dynamic> onAnswer;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onReview;
  final bool isReview;
  final bool canPrevious;
  final bool canNext;
  final VoidCallback onSubmit;
  final bool busy;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final options = question['options'] as List<dynamic>? ?? [];
    final type = question['type'] as String? ?? 'mcq';
    final answer = question['answer'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _Tag(label: 'Question ${index + 1} of $total'),
                const Spacer(),
                Text('${question['marks']} marks',
                    style: const TextStyle(color: Colors.blueGrey, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 20),
            LinearProgressIndicator(
              value: (index + 1) / total,
              backgroundColor: const Color(0xFFE7EEEB),
              color: _teal,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 24),
            Text(question['prompt'] as String? ?? '',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      height: 1.45, fontWeight: FontWeight.w700, color: _ink)),
            const SizedBox(height: 18),
            if (type == 'short_answer')
              TextFormField(
                initialValue: answer as String? ?? '',
                maxLength: 1000,
                decoration: const InputDecoration(
                  labelText: 'Your answer',
                  alignLabelWithHint: true,
                ),
                onChanged: onAnswer,
              )
            else
              ...options.map((raw) {
                final option = raw as Map<String, dynamic>;
                final optionId = option['id'];
                final selected = type == 'multiple_select'
                    ? (answer as List<dynamic>? ?? []).contains(optionId)
                    : answer == optionId;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () {
                      if (type == 'multiple_select') {
                        final values = [...(answer as List<dynamic>? ?? [])];
                        selected ? values.remove(optionId) : values.add(optionId);
                        onAnswer(values);
                      } else {
                        onAnswer(optionId);
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.all(15),
                      decoration: BoxDecoration(
                        color: selected ? const Color(0xFFE9F6F3) : Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                            color: selected ? _teal : const Color(0xFFE1E9E6)),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            type == 'multiple_select'
                                ? selected ? Icons.check_box : Icons.check_box_outline_blank
                                : selected ? Icons.radio_button_checked : Icons.radio_button_off,
                            color: selected ? _teal : Colors.blueGrey,
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Text(option['text'] as String? ?? '')),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            if (error != null) ...[
              const SizedBox(height: 10),
              ErrorBanner(message: error!),
            ],
            const Spacer(),
            const Divider(),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: onReview,
                  icon: Icon(isReview ? Icons.bookmark : Icons.bookmark_border),
                  label: Text(isReview ? 'Marked for review' : 'Mark for review'),
                ),
                const Spacer(),
                if (canPrevious)
                  OutlinedButton(onPressed: onPrevious, child: const Text('Previous')),
                if (canPrevious) const SizedBox(width: 8),
                if (canNext)
                  FilledButton(onPressed: onNext, child: const Text('Next')),
                if (!canNext)
                  FilledButton(
                    onPressed: busy ? null : onSubmit,
                    child: busy
                        ? const SizedBox(width: 18, height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Submit assessment'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ResultsView extends StatelessWidget {
  const ResultsView({required this.api, super.key});
  final ApiService api;

  @override
  Widget build(BuildContext context) => ApiListPage(
        title: 'Assessment history',
        subtitle: 'Your submitted attempts and server-calculated scores.',
        future: api.get('/results', query: const {'page': '1', 'per_page': '50'}),
        emptyIcon: Icons.query_stats_outlined,
        emptyTitle: 'Your first result will show up here',
        emptyMessage: 'When you complete an assessment, your score and attempt status will be saved here.',
        builder: (item) => Card(
          child: ListTile(
            leading: Icon(item['passed'] == true ? Icons.check_circle : Icons.history,
                color: item['passed'] == true ? _teal : Colors.blueGrey),
            title: Text(item['title'] as String? ?? 'Assessment'),
            subtitle: Text('${item['status']} · ${item['submitted_at'] ?? ''}'
                ' · ${item['correct_count'] ?? 0} correct'),
            trailing: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${_format(item['score_percent'])}%',
                        style: const TextStyle(fontWeight: FontWeight.w700, color: _ink)),
                    if (item['certificate_id'] != null)
                      const Text('Certificate earned', style: TextStyle(fontSize: 11, color: _teal)),
                  ],
                ),
                IconButton(
                  tooltip: 'Report a result issue',
                  onPressed: () => _reportResult(context, api, item['id'] as int),
                  icon: const Icon(Icons.flag_outlined, size: 19),
                ),
              ],
            ),
          ),
        ),
      );
}

class CertificatesView extends StatelessWidget {
  const CertificatesView({required this.api, super.key});
  final ApiService api;

  @override
  Widget build(BuildContext context) => ApiListPage(
        title: 'Your certificates',
        subtitle: 'Download a PDF or share the public verification link.',
        future: api.get('/certificates'),
        emptyIcon: Icons.workspace_premium_outlined,
        emptyTitle: 'Your credentials will live here',
        emptyMessage: 'Pass an eligible assessment to earn a verifiable certificate.',
        builder: (item) => Card(
          child: ListTile(
            leading: const Icon(Icons.workspace_premium_outlined, color: _teal),
            title: Text(item['title'] as String? ?? 'Certificate'),
            subtitle: Text('${item['certificate_id']} · ${item['issued_at']}'
                '${item['revoked_at'] == null ? '' : ' · REVOKED'}'),
            trailing: item['revoked_at'] == null
                ? Wrap(
                    spacing: 8,
                    children: [
                      IconButton(
                        tooltip: 'Open public verification page',
                        onPressed: () => launchUrl(
                          Uri.parse('${api.publicWebUrl}/verify/${item['certificate_id']}'),
                          mode: LaunchMode.externalApplication,
                        ),
                        icon: const Icon(Icons.verified_user_outlined),
                      ),
                      IconButton(
                        tooltip: 'Download certificate PDF',
                        onPressed: () => launchUrl(
                          Uri.parse('${api.apiBaseUrl}/certificates/${item['certificate_id']}/pdf'),
                          mode: LaunchMode.externalApplication,
                        ),
                        icon: const Icon(Icons.download_outlined),
                      ),
                    ],
                  )
                : const Chip(label: Text('Revoked')),
          ),
        ),
      );
}

class ManageView extends StatelessWidget {
  const ManageView({required this.api, required this.onChanged, super.key});
  final ApiService api;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
        future: api.get('/management/assessments'),
        builder: (context, snapshot) {
          if (snapshot.hasError) return ErrorState(message: snapshot.error.toString());
          if (!snapshot.hasData) return const LoadingState();
          final items = snapshot.data!['items'] as List<dynamic>? ?? [];
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                runSpacing: 12,
                children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Assessment studio',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              color: _ink, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 5),
                    const Text('Create and publish assessments you own.'),
                  ]),
                  FilledButton.icon(
                    onPressed: () async {
                      final data = await showDialog<Map<String, dynamic>>(
                        context: context,
                        builder: (_) => AssessmentEditorDialog(api: api),
                      );
                      if (data == null) return;
                      try {
                        await api.post('/management/assessments', data);
                        onChanged();
                      } on ApiException catch (error) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(error.message), backgroundColor: Colors.red),
                          );
                        }
                      }
                    },
                    icon: const Icon(Icons.add),
                    label: const Text('Create assessment'),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (items.isEmpty)
                const EmptyState(
                  icon: Icons.edit_note_outlined,
                  title: 'No assessments yet',
                  message: 'Create a draft assessment and publish it when it is ready.',
                )
              else
                ...items.map((raw) {
                  final item = raw as Map<String, dynamic>;
                  return Card(
                    child: ListTile(
                      leading: _StatusDot(status: item['status'] as String? ?? 'draft'),
                      title: Text(item['title'] as String? ?? ''),
                      subtitle: Text('${item['category']} · ${item['question_count']} questions · '
                          '${item['status']}'),
                      trailing: Wrap(
                        spacing: 4,
                        children: [
                          IconButton(
                            tooltip: 'Edit assessment',
                            onPressed: () => _editAssessment(context, item),
                            icon: const Icon(Icons.edit_outlined),
                          ),
                          IconButton(
                            tooltip: 'View performance',
                            onPressed: () => _showPerformance(context, item),
                            icon: const Icon(Icons.insights_outlined),
                          ),
                          PopupMenuButton<String>(
                            onSelected: (status) async {
                              if (status == 'delete') {
                                final confirm = await showDialog<bool>(
                                  context: context,
                                  builder: (context) => AlertDialog(
                                    title: const Text('Delete assessment?'),
                                    content: Text('Delete "${item['title']}" permanently? This cannot be undone.'),
                                    actions: [
                                      TextButton(onPressed: () => Navigator.pop(context, false),
                                          child: const Text('Cancel')),
                                      FilledButton(onPressed: () => Navigator.pop(context, true),
                                          child: const Text('Delete')),
                                    ],
                                  ),
                                );
                                if (confirm != true) return;
                                try {
                                  await api.delete('/management/assessments/${item['id']}');
                                  onChanged();
                                } on ApiException catch (error) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(error.message)),
                                    );
                                  }
                                }
                                return;
                              }
                              try {
                                await api.patch('/management/assessments/${item['id']}/status',
                                    {'status': status});
                                onChanged();
                              } on ApiException catch (error) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(error.message)),
                                  );
                                }
                              }
                            },
                            itemBuilder: (_) => const [
                              PopupMenuItem(value: 'published', child: Text('Publish')),
                              PopupMenuItem(value: 'draft', child: Text('Unpublish')),
                              PopupMenuItem(value: 'archived', child: Text('Archive')),
                              PopupMenuItem(value: 'delete', child: Text('Delete')),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              const SizedBox(height: 16),
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Published assessments are visible in the student catalog. Editing assessment settings after attempts begin is intentionally blocked; archive and create a new version instead.',
                    style: TextStyle(height: 1.5),
                  ),
                ),
              ),
            ],
          );
        },
      );

  Future<void> _editAssessment(
      BuildContext context, Map<String, dynamic> item) async {
    try {
      final detail = await api.get('/management/assessments/${item['id']}');
      if (!context.mounted) return;
      final initial = {
        ...(detail['assessment'] as Map<String, dynamic>),
        'questions': detail['questions'],
      };
      final data = await showDialog<Map<String, dynamic>>(
        context: context,
        builder: (_) => AssessmentEditorDialog(api: api, initial: initial),
      );
      if (data == null) return;
      await api.put('/management/assessments/${item['id']}', data);
      onChanged();
    } on ApiException catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _showPerformance(
      BuildContext context, Map<String, dynamic> assessment) async {
    try {
      final response = await api.get('/management/assessments/${assessment['id']}/performance');
      if (!context.mounted) return;
      final metrics = response['metrics'] as Map<String, dynamic>;
      showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text('${assessment['title']} performance'),
          content: Text(
            'Attempts: ${metrics['attempts']}\n'
            'Completed: ${metrics['completed']}\n'
            'Average score: ${metrics['average_score']}%\n'
            'Pass rate: ${metrics['pass_rate']}%',
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
        ),
      );
    } on ApiException catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }
}

class AssessmentEditorDialog extends StatefulWidget {
  const AssessmentEditorDialog({required this.api, this.initial, super.key});
  final ApiService api;
  final Map<String, dynamic>? initial;

  @override
  State<AssessmentEditorDialog> createState() => _AssessmentEditorDialogState();
}

class _AssessmentEditorDialogState extends State<AssessmentEditorDialog> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _prompt = TextEditingController();
  final _questionCountController = TextEditingController(text: '10');
  final _options = List.generate(4, (_) => TextEditingController());
  final List<Map<String, dynamic>> _generatedQuestions = [];
  String _category = 'Python';
  String _difficulty = 'Beginner';
  int _duration = 30;
  int _passingScore = 70;
  int _correct = 0;
  bool _generating = false;
  String? _generationNote;
  String? _generationError;
  bool _editable = true;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    if (initial == null) return;
    _title.text = initial['title'] as String? ?? '';
    _description.text = initial['description'] as String? ?? '';
    _category = initial['category'] as String? ?? _category;
    _difficulty = initial['difficulty'] as String? ?? _difficulty;
    _duration = (initial['duration_minutes'] as num?)?.toInt() ?? _duration;
    _passingScore = (initial['pass_percent'] as num?)?.toInt() ?? _passingScore;
    final questions = initial['questions'] as List<dynamic>? ?? [];
    if (questions.length != 1) {
      _editable = false;
      return;
    }
    final question = questions.single as Map<String, dynamic>;
    final options = question['options'] as List<dynamic>? ?? [];
    if (question['type'] != 'mcq' || options.length != _options.length) {
      _editable = false;
      return;
    }
    _prompt.text = question['prompt'] as String? ?? '';
    for (var index = 0; index < options.length; index++) {
      _options[index].text = (options[index] as Map<String, dynamic>)['text'] as String? ?? '';
    }
    final correct = question['correct_answers'] as List<dynamic>? ?? [];
    final correctId = correct.isEmpty ? null : correct.first;
    _correct = options.indexWhere(
      (option) => (option as Map<String, dynamic>)['id'] == correctId,
    );
    if (_correct < 0) _correct = 0;
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _prompt.dispose();
    _questionCountController.dispose();
    for (final option in _options) {
      option.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.initial == null ? 'Create an assessment' : 'Edit assessment'),
        content: SizedBox(
          width: 560,
          child: Form(
            key: _form,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!_editable)
                    const ErrorBanner(
                      message: 'This editor supports a single four-option MCQ only. Other assessment formats cannot be changed here.',
                    ),
                  _requiredField(_title, 'Assessment title'),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _description,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Description'),
                  ),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(child: TextFormField(
                      initialValue: _category,
                      maxLength: 80,
                      decoration: const InputDecoration(
                        labelText: 'Technical topic or language',
                        hintText: 'e.g. Rust, Go, Kubernetes, SQL',
                        counterText: '',
                      ),
                      validator: (value) => value == null || value.trim().isEmpty
                          ? 'Enter a topic'
                          : null,
                      onChanged: (value) {
                        _category = value.trim();
                        if (_generatedQuestions.isNotEmpty) {
                          setState(() {
                            _generatedQuestions.clear();
                            _generationNote = null;
                          });
                        }
                      },
                    )),
                    const SizedBox(width: 10),
                    Expanded(child: DropdownButtonFormField<String>(
                      initialValue: _difficulty,
                      decoration: const InputDecoration(labelText: 'Difficulty'),
                      items: const ['Beginner','Intermediate','Advanced']
                          .map((value) => DropdownMenuItem(value: value, child: Text(value))).toList(),
                      onChanged: (value) => setState(() {
                        _difficulty = value!;
                        _generatedQuestions.clear();
                        _generationNote = null;
                      }),
                    )),
                  ]),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(child: _numberField(
                      initial: _duration,
                      label: 'Duration (minutes)',
                      onChanged: (value) => _duration = value,
                      min: 1, max: 600,
                    )),
                    const SizedBox(width: 10),
                    Expanded(child: _numberField(
                      initial: _passingScore,
                      label: 'Pass percentage',
                      onChanged: (value) => _passingScore = value,
                      min: 0, max: 100,
                    )),
                  ]),
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(_generatedQuestions.isEmpty
                            ? 'Question 1 · Multiple choice'
                            : '${_generatedQuestions.length} questions · Multiple choice',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700, color: _ink)),
                        SizedBox(
                          width: 130,
                          child: TextFormField(
                            controller: _questionCountController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Questions (1–100)'),
                            validator: (value) {
                              final count = int.tryParse(value ?? '');
                              return count == null || count < 1 || count > 100
                                  ? 'Enter 1–100'
                                  : null;
                            },
                            onChanged: (_) {
                              if (_generatedQuestions.isNotEmpty) {
                                setState(() {
                                  _generatedQuestions.clear();
                                  _generationNote = null;
                                });
                              }
                            },
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: _generating ? null : _generateQuestion,
                          icon: _generating
                              ? const SizedBox(width: 16, height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.auto_awesome_outlined, size: 18),
                          label: Text(_generating ? 'Generating' : 'Generate draft'),
                        ),
                      ],
                    ),
                  ),
                  if (_generationNote != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(_generationNote!,
                            style: const TextStyle(color: _teal, fontSize: 12)),
                      ),
                    ),
                  if (_generationError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: ErrorBanner(message: _generationError!),
                    ),
                  if (_generatedQuestions.isNotEmpty)
                    ..._generatedQuestions.asMap().entries.map((entry) {
                      final question = entry.value;
                      final options = question['options'] as List<dynamic>;
                      final answers = question['correct_answers'] as List<dynamic>;
                      return Card(
                        margin: const EdgeInsets.only(top: 8),
                        child: ExpansionTile(
                          title: Text(
                            '${entry.key + 1}. ${question['prompt']}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: const Text('Review the answer key before saving'),
                          children: [
                            for (final option in options)
                              Builder(builder: (context) {
                                final item = option as Map<String, dynamic>;
                                final isCorrect = answers.contains(item['id']);
                                return ListTile(
                                  dense: true,
                                  leading: Icon(
                                    isCorrect ? Icons.check_circle : Icons.radio_button_unchecked,
                                    color: isCorrect ? _teal : Colors.blueGrey,
                                  ),
                                  title: Text(item['text'] as String),
                                );
                              }),
                            if ((question['explanation'] as String?)?.isNotEmpty ?? false)
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                child: Text(question['explanation'] as String),
                              ),
                          ],
                        ),
                      );
                    })
                  else ...[
                    const SizedBox(height: 10),
                    _requiredField(_prompt, 'Question prompt'),
                    const SizedBox(height: 8),
                    RadioGroup<int>(
                      groupValue: _correct,
                      onChanged: (value) => setState(() => _correct = value ?? 0),
                      child: Column(
                        children: [
                          for (var index = 0; index < _options.length; index++)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(children: [
                                Radio<int>(value: index),
                                Expanded(child: TextFormField(
                                  controller: _options[index],
                                  decoration: InputDecoration(labelText: 'Option ${String.fromCharCode(65 + index)}'),
                                  validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
                                )),
                              ]),
                            ),
                        ],
                      ),
                    ),
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Select the radio button beside the correct option.',
                          style: TextStyle(fontSize: 12, color: Colors.blueGrey)),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: !_editable ? null : () {
              if (!_form.currentState!.validate()) return;
              Navigator.pop(context, {
                'title': _title.text.trim(),
                'description': _description.text.trim(),
                'instructions': 'Choose one option for each question.',
                'category': _category,
                'difficulty': _difficulty,
                'duration_minutes': _duration,
                'pass_percent': _passingScore,
                'negative_marking': 0,
                'attempt_limit': 1,
                'status': widget.initial?['status'] ?? 'draft',
                'questions': _generatedQuestions.isNotEmpty
                    ? _generatedQuestions
                    : [
                  {
                    'prompt': _prompt.text.trim(),
                    'type': 'mcq',
                    'options': [
                      for (var i = 0; i < _options.length; i++)
                        {'id': 'option-${i + 1}', 'text': _options[i].text.trim()},
                    ],
                    'correct_answers': ['option-${_correct + 1}'],
                    'marks': 1,
                    'difficulty': _difficulty,
                    'category': _category,
                  }
                ],
              });
            },
            child: Text(widget.initial == null ? 'Save draft' : 'Save changes'),
          ),
        ],
      );

  Future<void> _generateQuestion() async {
    final questionCount = int.tryParse(_questionCountController.text);
    if (questionCount == null || questionCount < 1 || questionCount > 100) {
      setState(() => _generationError = 'Choose a question count from 1 to 100.');
      return;
    }
    if (_category.trim().length < 2) {
      setState(() => _generationError = 'Enter a technical subject or language.');
      return;
    }
    setState(() {
      _generating = true;
      _generationError = null;
      _generationNote = null;
    });
    try {
      final response = await widget.api.post('/management/questions/generate', {
        'topic': _category,
        'difficulty': _difficulty,
        'type': 'mcq',
        'count': questionCount,
      });
      final questions = response['questions'] as List<dynamic>;
      _generatedQuestions
        ..clear()
        ..addAll(questions.cast<Map<String, dynamic>>());
      _generationNote = '${response['source']} generated ${questions.length} draft questions. '
          'Review each question and answer key before saving.';
      setState(() {});
    } on ApiException catch (error) {
      setState(() => _generationError = error.message);
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Widget _requiredField(TextEditingController controller, String label) => TextFormField(
        controller: controller,
        decoration: InputDecoration(labelText: label),
        validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
      );

  Widget _numberField({
    required int initial,
    required String label,
    required ValueChanged<int> onChanged,
    required int min,
    required int max,
  }) => TextFormField(
        initialValue: '$initial',
        keyboardType: TextInputType.number,
        decoration: InputDecoration(labelText: label),
        validator: (value) {
          final parsed = int.tryParse(value ?? '');
          return parsed == null || parsed < min || parsed > max
              ? 'Enter $min–$max'
              : null;
        },
        onChanged: (value) => onChanged(int.tryParse(value) ?? initial),
      );
}

class AdminView extends StatefulWidget {
  const AdminView({required this.api, super.key});
  final ApiService api;

  @override
  State<AdminView> createState() => _AdminViewState();
}

class _AdminViewState extends State<AdminView> {
  final _search = TextEditingController();
  int _tab = 0;
  int _refreshKey = 0;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('Administration',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: _ink, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          const Text('System metrics, accounts, attempts, certificates, and issue reports.'),
          const SizedBox(height: 16),
          FutureBuilder<Map<String, dynamic>>(
            future: widget.api.get('/admin/metrics'),
            builder: (context, snapshot) {
              if (!snapshot.hasData) {
                return snapshot.hasError
                    ? ErrorBanner(message: snapshot.error.toString())
                    : const LinearProgressIndicator();
              }
              final data = snapshot.data!;
              return Wrap(spacing: 10, runSpacing: 10, children: [
                _MetricCard(label: 'Users', value: '${data['users']}', icon: Icons.people_outline, color: _teal),
                _MetricCard(label: 'Assessments', value: '${data['assessments']}', icon: Icons.menu_book_outlined, color: Colors.blue),
                _MetricCard(label: 'Attempts', value: '${data['attempts']}', icon: Icons.fact_check_outlined, color: Colors.orange),
                _MetricCard(label: 'Pass rate', value: '${_format(data['pass_rate'])}%', icon: Icons.track_changes, color: Colors.purple),
                _MetricCard(label: 'Certificates', value: '${data['certificates']}', icon: Icons.verified_outlined, color: Colors.teal),
                _MetricCard(label: 'Open issues', value: '${data['open_reports']}', icon: Icons.flag_outlined, color: Colors.red),
              ]);
            },
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(label: const Text('Users'), selected: _tab == 0, onSelected: (_) => setState(() => _tab = 0)),
              ChoiceChip(label: const Text('Attempts'), selected: _tab == 1, onSelected: (_) => setState(() => _tab = 1)),
              ChoiceChip(label: const Text('Certificates'), selected: _tab == 2, onSelected: (_) => setState(() => _tab = 2)),
              ChoiceChip(label: const Text('Reports'), selected: _tab == 3, onSelected: (_) => setState(() => _tab = 3)),
              ChoiceChip(label: const Text('Audit log'), selected: _tab == 4, onSelected: (_) => setState(() => _tab = 4)),
              ChoiceChip(label: const Text('Categories'), selected: _tab == 5, onSelected: (_) => setState(() => _tab = 5)),
            ],
          ),
          if (_tab == 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: TextField(
                controller: _search,
                decoration: InputDecoration(
                  hintText: 'Filter by name or email',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.refresh),
                    onPressed: () => setState(() {}),
                  ),
                ),
                onSubmitted: (_) => setState(() {}),
              ),
            ),
          const SizedBox(height: 12),
          _AdminData(
            key: ValueKey('admin-${_tab}_$_refreshKey'),
            api: widget.api,
            tab: _tab,
            search: _search.text,
            onChanged: () => setState(() => _refreshKey++),
          ),
          if (_tab == 1)
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: () async {
                  try {
                    await widget.api.downloadCsv('/admin/export/attempts.csv', 'skillcert-attempts.csv');
                  } on ApiException catch (error) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
                    }
                  }
                },
                icon: const Icon(Icons.download_outlined),
                label: const Text('Export attempts CSV'),
              ),
            ),
        ],
      );
}

class _AdminData extends StatelessWidget {
  const _AdminData({
    required this.api,
    required this.tab,
    required this.search,
    required this.onChanged,
    super.key,
  });
  final ApiService api;
  final int tab;
  final String search;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    if (tab == 5) return _CategoryAdminPanel(api: api, onChanged: onChanged);
    final path = switch (tab) {
      0 => '/admin/users',
      1 => '/admin/attempts',
      2 => '/admin/certificates',
      3 => '/admin/reports',
      _ => '/admin/audit-logs',
    };
    return FutureBuilder<Map<String, dynamic>>(
      future: api.get(path, query: tab == 0 ? {'search': search} : null),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return ErrorState(message: snapshot.error.toString());
        }
        if (!snapshot.hasData) {
          return const LoadingState();
        }
        final items = snapshot.data!['items'] as List<dynamic>? ?? [];
        if (items.isEmpty) {
          return const EmptyState(
            icon: Icons.inbox_outlined, title: 'Nothing to review',
            message: 'Records will appear here as the platform is used.',
          );
        }
        return Column(
          children: items.map((raw) {
            final item = raw as Map<String, dynamic>;
            if (tab == 0) {
              return Card(
                child: ListTile(
                  leading: CircleAvatar(child: Text((item['name'] as String? ?? 'U').characters.first)),
                  title: Text(item['name'] as String? ?? ''),
                  subtitle: Text(item['email'] as String? ?? ''),
                  trailing: DropdownButton<String>(
                    value: item['role'] as String,
                    items: const ['student', 'instructor', 'admin']
                        .map((role) => DropdownMenuItem(value: role, child: Text(role))).toList(),
                    onChanged: (role) async {
                      if (role == null || role == item['role']) return;
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Change account role?'),
                          content: Text('Set ${item['name']} to $role? This changes their server permissions.'),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Change role')),
                          ],
                        ),
                      );
                      if (confirmed != true) return;
                      try {
                        await api.patch('/admin/users/${item['id']}/role', {'role': role});
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Role updated.')));
                          onChanged();
                        }
                      } on ApiException catch (error) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
                        }
                      }
                    },
                  ),
                ),
              );
            }
            if (tab == 1) {
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.fact_check_outlined),
                  title: Text(item['assessment_title'] as String? ?? ''),
                  subtitle: Text('${item['student_name']} · ${item['status']} · ${item['submitted_at'] ?? ''}'),
                  trailing: Text(item['score_percent'] == null ? '—' : '${item['score_percent']}%'),
                ),
              );
            }
            if (tab == 4) {
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.history_outlined),
                  title: Text('${item['action']} · ${item['entity_type']} ${item['entity_id']}'),
                  subtitle: Text('${item['actor'] ?? 'System'} · ${item['created_at']} · '
                      '${item['details_json']}'),
                ),
              );
            }
            if (tab == 2) {
              final revoked = item['revoked_at'] != null;
              return Card(
                child: ListTile(
                  leading: Icon(revoked ? Icons.block : Icons.verified_outlined,
                      color: revoked ? Colors.red : _teal),
                  title: Text(item['certificate_id'] as String? ?? ''),
                  subtitle: Text('${item['student_name']} · ${item['assessment_title']} · '
                      '${revoked ? 'Revoked: ${item['revocation_reason']}' : 'Active'}'),
                  trailing: revoked ? null : TextButton(
                    onPressed: () => _revoke(context, item['certificate_id'] as String),
                    child: const Text('Revoke'),
                  ),
                ),
              );
            }
            return Card(
              child: ListTile(
                leading: const Icon(Icons.flag_outlined, color: Colors.orange),
                title: Text('${item['kind']} report · ${item['status']}'),
                subtitle: Text('${item['user_name']} · ${item['message']}'),
                trailing: PopupMenuButton<String>(
                  onSelected: (status) async {
                    try {
                      await api.patch('/admin/reports/${item['id']}', {'status': status});
                      onChanged();
                    } on ApiException catch (error) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
                      }
                    }
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'reviewing', child: Text('Mark reviewing')),
                    PopupMenuItem(value: 'resolved', child: Text('Resolve')),
                  ],
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }

  Future<void> _revoke(BuildContext context, String certificateId) async {
    final reason = TextEditingController();
    final form = GlobalKey<FormState>();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revoke certificate'),
        content: Form(
          key: form,
          child: TextFormField(
            controller: reason,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Reason for revocation'),
            validator: (value) => value == null || value.trim().length < 3 ? 'Add a reason' : null,
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () {
            if (form.currentState!.validate()) Navigator.pop(context, true);
          }, child: const Text('Revoke certificate')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await api.post('/admin/certificates/$certificateId/revoke', {'reason': reason.text});
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Certificate revoked.')));
        onChanged();
      }
    } on ApiException catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }
}

class VerifyView extends StatefulWidget {
  const VerifyView({required this.api, super.key});
  final ApiService api;
  @override
  State<VerifyView> createState() => _VerifyViewState();
}

class _VerifyViewState extends State<VerifyView> {
  final _id = TextEditingController();
  Map<String, dynamic>? _result;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _id.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_id.text.trim().isEmpty) {
      setState(() => _error = 'Enter a certificate ID.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
    });
    try {
      _result = await widget.api.get('/certificates/verify/${Uri.encodeComponent(_id.text.trim())}');
    } on ApiException catch (error) {
      if (error.statusCode == 404) {
        _result = {'valid': false, 'status': 'not_found'};
      } else {
        _error = error.message;
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 650),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(24),
            children: [
              const Icon(Icons.verified_user_outlined, size: 56, color: _teal),
              const SizedBox(height: 14),
              Text('Verify a certificate',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w700, color: _ink)),
              const SizedBox(height: 8),
              const Text('Check whether a SkillCert credential is currently valid.',
                  textAlign: TextAlign.center),
              const SizedBox(height: 24),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _id,
                    decoration: const InputDecoration(
                      labelText: 'Certificate ID',
                      hintText: 'SC-YYYYMMDD-XXXXXXXXXX',
                    ),
                    onSubmitted: (_) => _verify(),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton(
                  onPressed: _busy ? null : _verify,
                  child: _busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Verify'),
                ),
              ]),
              if (_error != null) ...[
                const SizedBox(height: 12),
                ErrorBanner(message: _error!),
              ],
              if (_result != null) ...[
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: _result!['status'] == 'not_found'
                        ? const Text('Certificate not found.',
                            style: TextStyle(fontWeight: FontWeight.w700))
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Icon(
                                  _result!['valid'] == true ? Icons.verified : Icons.block,
                                  color: _result!['valid'] == true ? _teal : Colors.red,
                                ),
                                const SizedBox(width: 10),
                                Text('Certificate ${_result!['status']}',
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                              ]),
                              const Divider(height: 28),
                              _VerificationLine('Credential', _result!['certificate_id']),
                              _VerificationLine('Assessment', _result!['assessment']),
                              _VerificationLine('Recipient', _result!['student_name']),
                              _VerificationLine('Score', '${_result!['score_percent']}%'),
                              _VerificationLine('Issued', _result!['issued_at']),
                            ],
                          ),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

class PublicVerificationPage extends StatelessWidget {
  const PublicVerificationPage({required this.api, required this.certificateId, super.key});
  final ApiService api;
  final String certificateId;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Brand()),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: FutureBuilder<Map<String, dynamic>>(
              future: api.get('/certificates/verify/${Uri.encodeComponent(certificateId)}'),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return ErrorState(message: snapshot.error.toString());
                }
                if (!snapshot.hasData) return const LoadingState();
                final result = snapshot.data!;
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(result['valid'] == true ? Icons.verified : Icons.block,
                            size: 60, color: result['valid'] == true ? _teal : Colors.red),
                        const SizedBox(height: 16),
                        Text('Certificate ${result['status']}',
                            style: Theme.of(context).textTheme.headlineSmall),
                        if (result['valid'] == true) ...[
                          const SizedBox(height: 18),
                          _VerificationLine('Recipient', result['student_name']),
                          _VerificationLine('Assessment', result['assessment']),
                          _VerificationLine('Score', '${result['score_percent']}%'),
                          _VerificationLine('Issued', result['issued_at']),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      );
}

class NotificationsDialog extends StatelessWidget {
  const NotificationsDialog({required this.api, super.key});
  final ApiService api;

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Notifications'),
        content: SizedBox(
          width: 420,
          child: FutureBuilder<Map<String, dynamic>>(
            future: api.get('/notifications'),
            builder: (context, snapshot) {
              if (snapshot.hasError) return Text(snapshot.error.toString());
              if (!snapshot.hasData) return const SizedBox(height: 100, child: LoadingState());
              final items = snapshot.data!['items'] as List<dynamic>? ?? [];
              if (items.isEmpty) return const Text('You are all caught up.');
              return ListView(
                shrinkWrap: true,
                children: items.map((raw) {
                  final item = raw as Map<String, dynamic>;
                  return ListTile(
                    leading: Icon(item['read_at'] == null
                        ? Icons.mark_email_unread_outlined
                        : Icons.mark_email_read_outlined),
                    title: Text(item['message'] as String? ?? ''),
                    subtitle: Text(item['created_at'] as String? ?? ''),
                    onTap: () async {
                      try {
                        await api.patch('/notifications/${item['id']}/read');
                      } on ApiException catch (error) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
                        }
                      }
                    },
                  );
                }).toList(),
              );
            },
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      );
}

class _CategoryAdminPanel extends StatelessWidget {
  const _CategoryAdminPanel({required this.api, required this.onChanged});
  final ApiService api;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
        future: api.get('/categories'),
        builder: (context, snapshot) {
          if (snapshot.hasError) return ErrorState(message: snapshot.error.toString());
          if (!snapshot.hasData) return const LoadingState();
          final categories = snapshot.data!['items'] as List<dynamic>? ?? [];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.icon(
                  onPressed: () => _addCategory(context),
                  icon: const Icon(Icons.add),
                  label: const Text('Add category'),
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: categories.map((name) => Chip(
                  avatar: const Icon(Icons.category_outlined, size: 17),
                  label: Text(name.toString()),
                )).toList(),
              ),
            ],
          );
        },
      );

  Future<void> _addCategory(BuildContext context) async {
    final name = TextEditingController();
    final form = GlobalKey<FormState>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add assessment category'),
        content: Form(
          key: form,
          child: TextFormField(
            controller: name,
            maxLength: 80,
            decoration: const InputDecoration(labelText: 'Category name'),
            validator: (value) => value == null || value.trim().isEmpty ? 'Enter a name' : null,
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () {
            if (form.currentState!.validate()) Navigator.pop(context, true);
          }, child: const Text('Add category')),
        ],
      ),
    );
    if (confirmed != true) {
      name.dispose();
      return;
    }
    try {
      await api.post('/categories', {'name': name.text.trim()});
      onChanged();
    } on ApiException catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      name.dispose();
    }
  }
}

class ApiListPage extends StatelessWidget {
  const ApiListPage({
    required this.title,
    required this.subtitle,
    required this.future,
    required this.emptyIcon,
    required this.emptyTitle,
    required this.emptyMessage,
    required this.builder,
    super.key,
  });
  final String title;
  final String subtitle;
  final Future<Map<String, dynamic>> future;
  final IconData emptyIcon;
  final String emptyTitle;
  final String emptyMessage;
  final Widget Function(Map<String, dynamic>) builder;

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
        future: future,
        builder: (context, snapshot) {
          if (snapshot.hasError) return ErrorState(message: snapshot.error.toString());
          if (!snapshot.hasData) return const LoadingState();
          final items = snapshot.data!['items'] as List<dynamic>? ?? [];
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: _ink, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(subtitle),
              const SizedBox(height: 18),
              if (items.isEmpty)
                EmptyState(icon: emptyIcon, title: emptyTitle, message: emptyMessage)
              else
                ...items.map((raw) => builder(raw as Map<String, dynamic>)),
            ],
          );
        },
      );
}

Future<void> _reportResult(BuildContext context, ApiService api, int attemptId) async {
  final message = TextEditingController();
  final form = GlobalKey<FormState>();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Report a result issue'),
      content: Form(
        key: form,
        child: TextFormField(
          controller: message,
          minLines: 2,
          maxLines: 5,
          maxLength: 4000,
          decoration: const InputDecoration(labelText: 'Describe the issue'),
          validator: (value) => value == null || value.trim().isEmpty ? 'Enter a message' : null,
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        FilledButton(onPressed: () {
          if (form.currentState!.validate()) Navigator.pop(context, true);
        }, child: const Text('Submit report')),
      ],
    ),
  );
  if (confirmed != true) {
    message.dispose();
    return;
  }
  try {
    await api.post('/reports', {
      'kind': 'result',
      'attempt_id': attemptId,
      'message': message.text.trim(),
    });
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your report was sent for review.')),
      );
    }
  } on ApiException catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  } finally {
    message.dispose();
  }
}

class Brand extends StatelessWidget {
  const Brand({this.dark = false, super.key});
  final bool dark;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            height: 36,
            width: 36,
            decoration: BoxDecoration(
              color: dark ? const Color(0xFF174D4A) : const Color(0xFFE2F3EF),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(Icons.auto_awesome, color: dark ? const Color(0xFF76D3C2) : _teal, size: 20),
          ),
          const SizedBox(width: 10),
          Text('skillcert',
              style: TextStyle(
                color: dark ? Colors.white : _ink,
                fontWeight: FontWeight.w800,
                fontSize: 20,
                letterSpacing: -.5,
              )),
        ],
      );
}

class _FeatureLine extends StatelessWidget {
      const _FeatureLine({required this.icon, required this.label});
      final IconData icon;
      final String label;

      @override
      Widget build(BuildContext context) => Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Row(children: [
              Icon(icon, color: const Color(0xFF76D3C2), size: 20),
              const SizedBox(width: 12),
              Text(label, style: const TextStyle(color: Colors.white)),
            ]),
          );
}

class _NavEntry {
  const _NavEntry(this.label, this.icon);
  final String label;
  final IconData icon;
}

class _NavList extends StatelessWidget {
  const _NavList({required this.entries, required this.selected, required this.onSelect});
  final List<_NavEntry> entries;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) => Column(
        children: List.generate(entries.length, (index) {
          final entry = entries[index];
          final active = index == selected;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
            child: ListTile(
              selected: active,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              selectedTileColor: const Color(0xFFE7F4F1),
              leading: Icon(entry.icon, color: active ? _teal : const Color(0xFF71817D)),
              title: Text(entry.label, style: TextStyle(
                color: active ? _teal : _ink,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              )),
              onTap: () => onSelect(index),
            ),
          );
        }),
      );
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 205,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Icon(icon, color: color),
                  const Spacer(),
                  Container(
                    width: 8, height: 8,
                    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                ]),
                const SizedBox(height: 18),
                Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: _ink, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(label, style: const TextStyle(color: Color(0xFF64736F))),
              ],
            ),
          ),
        ),
      );
}

class ProgressChart extends StatelessWidget {
  const ProgressChart({required this.values, super.key});
  final List<double> values;

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) {
      return const SizedBox(
        height: 140,
        child: Center(child: Text('Complete an assessment to start your score history.')),
      );
    }
    return Semantics(
      label: 'Assessment score history: ${values.map((value) => '${value.toStringAsFixed(0)} percent').join(', ')}',
      child: SizedBox(
        height: 160,
        width: double.infinity,
        child: CustomPaint(
          painter: _ProgressPainter(values),
          child: Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 4),
            child: Align(
              alignment: Alignment.bottomLeft,
              child: Text('${values.length} recent attempts',
                  style: const TextStyle(fontSize: 11, color: Colors.blueGrey)),
            ),
          ),
        ),
      ),
    );
  }
}

class _ProgressPainter extends CustomPainter {
  _ProgressPainter(this.values);
  final List<double> values;

  @override
  void paint(Canvas canvas, Size size) {
    const left = 30.0;
    const top = 10.0;
    const bottom = 24.0;
    const right = 8.0;
    final chartWidth = size.width - left - right;
    final chartHeight = size.height - top - bottom;
    final gridPaint = Paint()
      ..color = const Color(0xFFE6ECE9)
      ..strokeWidth = 1;
    final labelStyle = const TextStyle(color: Color(0xFF7A8984), fontSize: 10);
    for (var level = 0; level <= 100; level += 25) {
      final y = top + chartHeight * (1 - level / 100);
      canvas.drawLine(Offset(left, y), Offset(size.width - right, y), gridPaint);
      final label = TextPainter(
        text: TextSpan(text: '$level', style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      label.paint(canvas, Offset(0, y - label.height / 2));
    }
    final points = List.generate(values.length, (index) {
      final x = values.length == 1
          ? left + chartWidth / 2
          : left + chartWidth * index / (values.length - 1);
      final y = top + chartHeight * (1 - values[index].clamp(0, 100) / 100);
      return Offset(x, y);
    });
    if (points.length > 1) {
      final path = Path()..moveTo(points.first.dx, points.first.dy);
      for (var index = 1; index < points.length; index++) {
        path.lineTo(points[index].dx, points[index].dy);
      }
      canvas.drawPath(path, Paint()
        ..color = _teal
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round);
    }
    for (final point in points) {
      canvas.drawCircle(point, 4, Paint()..color = _teal);
      canvas.drawCircle(point, 2, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(covariant _ProgressPainter oldDelegate) =>
      oldDelegate.values != values;
}

class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {this.trailing, super.key});
  final String title;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          Expanded(child: Text(title, style: const TextStyle(
            color: _ink, fontSize: 18, fontWeight: FontWeight.w700,
          ))),
          ?trailing,
        ]),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.icon,
    required this.title,
    required this.message,
    super.key,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
          child: Column(
            children: [
              Icon(icon, color: _teal, size: 40),
              const SizedBox(height: 12),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: _ink)),
              const SizedBox(height: 6),
              Text(message, textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF63736E), height: 1.5)),
            ],
          ),
        ),
      );
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key});
  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(30),
          child: CircularProgressIndicator(color: _teal),
        ),
      );
}

class ErrorState extends StatelessWidget {
  const ErrorState({required this.message, this.onRetry, super.key});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_outlined, color: Colors.red, size: 42),
                const SizedBox(height: 12),
                const Text('We could not load this data',
                    style: TextStyle(fontWeight: FontWeight.w700, color: _ink)),
                const SizedBox(height: 8),
                Text(message, textAlign: TextAlign.center),
                if (onRetry != null) ...[
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Try again'),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({required this.message, super.key});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFEEEC),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(message, style: const TextStyle(color: Color(0xFF9D3430))),
      );
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFE6F4F0),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: const TextStyle(
          color: _teal, fontSize: 12, fontWeight: FontWeight.w700,
        )),
      );
}

class _InfoPill extends StatelessWidget {
  const _InfoPill(this.icon, this.label);
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF697A75)),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Color(0xFF53645F), fontSize: 12)),
        ],
      );
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});
  final Color color;
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 5),
        child: Row(children: [
          Container(
            width: 12, height: 12,
            decoration: BoxDecoration(
              color: color,
              border: Border.all(color: const Color(0xFFCAD6D1)),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 7),
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.blueGrey)),
        ]),
      );
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) => Icon(
        status == 'published'
            ? Icons.public
            : status == 'archived'
                ? Icons.inventory_2_outlined
                : Icons.edit_note_outlined,
        color: status == 'published' ? _teal : Colors.blueGrey,
      );
}

class _VerificationLine extends StatelessWidget {
  const _VerificationLine(this.label, this.value);
  final String label;
  final Object? value;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          SizedBox(width: 105, child: Text(label, style: const TextStyle(color: Colors.blueGrey))),
          Expanded(child: Text(value?.toString() ?? '—',
              style: const TextStyle(color: _ink, fontWeight: FontWeight.w600))),
        ]),
      );
}

String _format(dynamic value) {
  if (value is num) return value.toStringAsFixed(1);
  return '0.0';
}
