import * as vscode from 'vscode';
import { I18nProvider } from './i18nProvider';
import { I18nLocalesScanner } from './i18nLocalesScanner';

/**
 * Rails I18n 확장 프로그램
 */
export function activate(context: vscode.ExtensionContext) {
  // 출력 채널 초기화
  const outputChannel = vscode.window.createOutputChannel('Rails I18n');
  outputChannel.appendLine('Rails I18n 확장 프로그램이 활성화되었습니다.');
  
  // 로케일 스캐너 및 제공자 초기화
  const localesScanner = new I18nLocalesScanner(outputChannel);
  const provider = new I18nProvider(localesScanner, outputChannel);
  
  // 기능 등록
  registerProviders(context, provider);
  registerCommands(context, localesScanner);
  
  // 활성화 시 초기 스캔 실행
  localesScanner.scanLocaleFiles().catch(err => {
    console.error('초기 스캔 중 오류 발생:', err);
  });
}

/**
 * 모든 제공자 등록
 */
function registerProviders(context: vscode.ExtensionContext, provider: I18nProvider): void {
  // 자동 완성 제공자
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      ['ruby', 'erb'], 
      provider, 
      '.', // 트리거 문자
      '(', // I18n.t( 이후에 자동 완성 제공
      '"',
      "'"
    )
  );
  
  // 호버 제공자
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(['ruby', 'erb'], provider)
  );
  
  // 정의 제공자
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(['ruby', 'erb'], provider)
  );
}

/**
 * 명령 등록
 */
function registerCommands(context: vscode.ExtensionContext, localesScanner: I18nLocalesScanner): void {
  // 로케일 파일 스캔 명령
  context.subscriptions.push(
    vscode.commands.registerCommand('rails-i18n.scanI18nKeys', async () => {
      try {
        await localesScanner.scanLocaleFiles();
        vscode.window.showInformationMessage('I18n 키 스캔이 완료되었습니다.');
      } catch (error) {
        console.error('I18n 키 스캔 중 오류 발생:', error);
        vscode.window.showErrorMessage(`I18n 키 스캔 중 오류가 발생했습니다: ${error}`);
      }
    })
  );
}

/**
 * 확장 프로그램 비활성화
 */
export function deactivate() {
  console.log('Rails I18n 확장 프로그램이 비활성화되었습니다.');
} 