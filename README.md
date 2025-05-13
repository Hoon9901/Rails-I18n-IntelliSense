# Rails I18n IntelliSense

Rails 프로젝트를 위한 VS Code I18n IntelliSense 확장 프로그램입니다. `config/locales` 디렉토리의 로케일 파일을 자동으로 스캔하여 `I18n.t` 호출에 자동 완성, 호버 정보, 번역 키 정의로 이동 기능을 제공합니다.

![호버 미리보기](images/hover-preview.png)

## ✨ 주요 기능

- **🔍 자동 완성**: `I18n.t(` 또는 `t(` 입력 시 사용 가능한 모든 I18n 키 자동 완성
- **💬 호버 정보**: I18n 키 위에 마우스를 올리면 해당 번역과 파일 정보 표시
- **🚀 정의로 이동**: 키에서 해당 번역이 정의된 YAML 파일로 바로 이동 (F12 또는 Ctrl+클릭)
- **🔄 실시간 스캔**: 커맨드 팔레트에서 `Rails I18n IntelliSense: 키 스캔` 명령으로 수동 스캔
- **🌐 다국어 지원**: 프로젝트의 모든 언어 번역을 자동 감지하여 표시
- **#{} 동적 키 지원**: 변수를 포함한 동적 키도 올바르게 처리

## 📦 설치 방법

### VS Code 마켓플레이스에서 설치

1. VS Code 확장 마켓플레이스에서 `Rails I18n IntelliSense` 검색
2. 설치 버튼 클릭
3. Rails 프로젝트 열고 사용 시작

### VSIX 파일로 설치

1. 릴리스 페이지에서 최신 `.vsix` 파일 다운로드
2. VS Code에서 확장 탭 열기 (Ctrl+Shift+X)
3. `...` 메뉴에서 "VSIX에서 설치" 선택
4. 다운로드한 `.vsix` 파일 선택

## 🚀 사용 방법

### 자동 완성

Ruby 또는 ERB 파일에서 `I18n.t(` 또는 `t(` 입력 시 IntelliSense 자동 완성 목록이 표시됩니다:

![자동 완성 예시](images/completion-preview.png)

### 호버 정보

I18n 키 위에 마우스를 올리면 해당 키의 모든 언어 번역이 표시됩니다:

- 정확히 일치하는 키에 대한 번역
- 동적 키(`#{variable}` 포함)에 대한 관련 번역
- 언어별 국기 이모지와 함께 표시

### 정의로 이동

번역 키에서 `F12` 또는 `Ctrl+클릭`을 통해 해당 번역이 정의된 YAML 파일로 바로 이동할 수 있습니다.

### 수동 스캔

커맨드 팔레트(`F1` 또는 `Ctrl+Shift+P`)에서 `Rails I18n IntelliSense: 키 스캔` 명령을 실행하여 번역 키를 다시 스캔할 수 있습니다.

## ⚙️ 설정 옵션

이 확장 프로그램은 다음 설정을 제공합니다:

- `rails-i18n.localesPaths`: 로케일 파일 경로 (기본값: `["config/locales"]`)
- `rails-i18n.debugMode`: 디버그 모드 활성화 (기본값: `false`)

## 💡 팁과 요령

- **동적 키 사용**: `I18n.t("user.greeting.#{user_type}")` 같은 동적 키 사용 시에도 관련 번역을 보여줍니다.
- **언어 우선순위**: ko, en, ja 언어가 먼저 표시되고, 이후 알파벳 순으로 정렬됩니다.
- **기본 경로 외 로케일**: 설정에서 추가 로케일 경로를 지정할 수 있습니다.

## 🐛 문제 해결

- **번역 키가 나타나지 않을 때**: `Rails I18n IntelliSense: 키 스캔` 명령으로 수동 스캔을 실행해보세요.
- **디버그 정보 확인**: 출력 패널의 'Rails I18n IntelliSense' 채널에서 로그를 확인할 수 있습니다.
- **호버가 작동하지 않을 때**: `I18n.t` 또는 `t` 메서드 호출이 정확한지 확인하세요.

## 👨‍💻 개발

### 환경 설정

```bash
git clone https://github.com/Hoon9901/rails-i18n-intellisense.git
cd rails-i18n-intellisense
npm install
```

### 컴파일 및 실행

```bash
npm run compile
# 또는 실시간 컴파일
npm run watch
```

### 디버깅

VS Code에서 F5 키를 눌러 확장 프로그램 디버깅 세션을 시작할 수 있습니다.

### 패키징

```bash
npx vsce package
```

## 📄 라이센스

MIT 라이센스 하에 배포됩니다.