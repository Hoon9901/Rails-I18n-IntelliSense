import * as vscode from 'vscode';
import { I18nLocalesScanner, I18nEntry } from './i18nLocalesScanner';

export class I18nProvider implements vscode.CompletionItemProvider, vscode.HoverProvider, vscode.DefinitionProvider {
  private outputChannel: vscode.OutputChannel;
  private debugMode: boolean = false;
  
  constructor(private localesScanner: I18nLocalesScanner, outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.updateDebugMode();
  }
  
  /**
   * 디버그 모드 설정 업데이트
   */
  private updateDebugMode(): void {
    const config = vscode.workspace.getConfiguration('rails-i18n');
    this.debugMode = config.get('debugMode') || false;
  }
  
  /**
   * 로그 출력
   */
  private log(message: string, force: boolean = false): void {
    if (force || this.debugMode) {
      console.log(message);
      this.outputChannel.appendLine(message);
    }
  }
  
  /**
   * 감지된 언어 코드 목록 가져오기
   */
  private getLanguageCodes(): string[] {
    // 스캔된 항목들에서 언어 코드 추출
    const entries = this.localesScanner.getEntries();
    const langSet = new Set<string>();
    
    // 언어 코드 수집
    entries.forEach(entry => {
      if (entry.lang) {
        langSet.add(entry.lang);
      }
    });
    
    // 자주 사용되는 언어 코드를 우선 정렬
    const priorityLangs = ['ko', 'en', 'ja'];
    const result: string[] = [];
    
    // 우선 순위 언어 먼저 추가
    priorityLangs.forEach(lang => {
      if (langSet.has(lang)) {
        result.push(lang);
        langSet.delete(lang);
      }
    });
    
    // 나머지 언어 알파벳 순으로 추가
    return result.concat(Array.from(langSet).sort());
  }
  
  /**
   * 자동 완성 항목 제공
   */
  public provideCompletionItems(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    this.updateDebugMode();
    this.log('자동 완성 호출됨', true);
    
    // 현재 라인 텍스트 가져오기
    const lineText = document.lineAt(position).text;
    const linePrefix = lineText.substring(0, position.character);
    
    this.log(`자동 완성: 현재 라인 - ${lineText}`, true);
    
    // I18n.t 또는 t 메소드 호출 여부 확인
    const isI18nCall = /I18n\.t\(['"]$/.test(linePrefix) || /t\(['"]$/.test(linePrefix);
    
    if (!isI18nCall && !linePrefix.includes('I18n') && !linePrefix.includes('t(')) {
      this.log('자동 완성: I18n 호출이 아님', this.debugMode);
      return undefined;
    }
    
    const entries = this.localesScanner.getEntries();
    if (entries.length === 0) {
      this.log('자동 완성: 항목 없음, 스캔 시작', true);
      this.localesScanner.scanLocaleFiles();
      return new vscode.CompletionList([new vscode.CompletionItem(
        '스캔 중... 잠시 후 다시 시도하세요.', 
        vscode.CompletionItemKind.Text
      )]);
    }
    
    this.log(`자동 완성: ${entries.length}개 항목 발견`, this.debugMode);
    
    return this.createCompletionItems(entries);
  }
  
  /**
   * 자동 완성 항목 생성
   */
  private createCompletionItems(entries: I18nEntry[]): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];
    const languageCodes = this.getLanguageCodes();
    
    // 언어별로 항목 정렬 및 분류
    const sortedEntries = this.sortEntriesByLanguage(entries, languageCodes);
    
    // 로케일 키 기반으로 자동 완성 항목 생성
    sortedEntries.forEach(entry => {
      const item = new vscode.CompletionItem(entry.key, vscode.CompletionItemKind.Text);
      
      // 언어 정보 표시
      const langInfo = entry.lang ? `[${entry.lang}] ` : '';
      
      // 키 값 미리보기 추가
      item.detail = `${langInfo}${entry.value}`;
      item.documentation = new vscode.MarkdownString(`**${entry.key}**\n\n${entry.value}\n\n*파일: ${entry.file}*`);
      
      // 설정된 언어 항목의 순위 조정
      if (entry.lang) {
        const langIndex = languageCodes.indexOf(entry.lang);
        if (langIndex !== -1) {
          item.sortText = `${langIndex}-${entry.key}`;
        } else {
          item.sortText = `${languageCodes.length}-${entry.key}`;
        }
      } else {
        item.sortText = `${languageCodes.length + 1}-${entry.key}`;
      }
      
      completionItems.push(item);
    });
    
    return completionItems;
  }
  
  /**
   * 언어 코드별로 항목 정렬
   */
  private sortEntriesByLanguage(entries: I18nEntry[], languageCodes: string[]): I18nEntry[] {
    // 설정된 언어 코드로 항목 정렬
    const entriesByLang: { [lang: string]: I18nEntry[] } = {};
    const otherEntries: I18nEntry[] = [];
    
    // 언어별로 분류
    entries.forEach(entry => {
      if (entry.lang && languageCodes.includes(entry.lang)) {
        if (!entriesByLang[entry.lang]) {
          entriesByLang[entry.lang] = [];
        }
        entriesByLang[entry.lang].push(entry);
      } else {
        otherEntries.push(entry);
      }
    });
    
    // 설정된 언어 순서대로 항목 추가
    const sortedEntries: I18nEntry[] = [];
    languageCodes.forEach(lang => {
      if (entriesByLang[lang]) {
        sortedEntries.push(...entriesByLang[lang]);
      }
    });
    
    // 기타 언어 항목 추가
    sortedEntries.push(...otherEntries);
    
    return sortedEntries;
  }
  
  /**
   * 호버 정보 제공
   */
  public provideHover(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    this.updateDebugMode();
    this.log('호버 호출됨', this.debugMode);
    
    // 현재 라인 텍스트 가져오기
    const lineText = document.lineAt(position).text;
    
    // I18n.t 호출 패턴이 있는지 먼저 확인
    if (!lineText.includes('I18n.t') && !lineText.includes('t(')) {
      this.log('호버: 매칭되는 I18n 호출이 없음', this.debugMode);
      return undefined;
    }
    
    // 현재 위치의 단어 가져오기
    const wordRange = document.getWordRangeAtPosition(position);
    let wordUnderCursor = '';
    if (wordRange) {
      wordUnderCursor = document.getText(wordRange);
    }
    
    // I18n.t 호출에서 키 추출
    const key = this.extractKeyFromPosition(document, position, lineText, wordUnderCursor);
    
    if (!key) {
      this.log('호버: I18n.t 호출은 발견했으나 키 추출 실패', this.debugMode);
      return undefined;
    }
    
    this.log(`호버: 키 "${key}" 검색 중`, this.debugMode);
    
    // 로케일 스캔 확인
    const entries = this.localesScanner.getEntries();
    if (entries.length === 0) {
      this.log('호버: 항목 없음, 스캔 필요', true);
      const content = new vscode.MarkdownString('I18n 키를 스캔 중입니다. 명령 팔레트에서 "Rails I18n: 키 스캔"을 실행해보세요.');
      return new vscode.Hover(content);
    }
    
    // 정확히 일치하는 키 먼저 검색
    let matchedEntries = entries.filter(entry => entry.key === key);
    
    // 동적 키(변수 포함) 처리
    const isDynamicKey = key.includes('#{');
    
    if (matchedEntries.length === 0 && isDynamicKey) {
      this.log(`호버: 동적 키 "${key}" 처리 중`, this.debugMode);
      // 변수 부분을 제외한 기본 키 추출
      const baseKey = key.split('#{')[0].replace(/\.$/, '');
      if (baseKey.length > 0) {
        // 기본 키로 시작하는 항목 찾기
        const baseEntries = entries.filter(entry => entry.key.startsWith(baseKey))
          .sort((a, b) => a.key.length - b.key.length);
        
        if (baseEntries.length > 0) {
          // 최대 3개까지만 표시
          matchedEntries = baseEntries.slice(0, 3);
          this.log(`호버: 동적 키에 대해 ${matchedEntries.length}개 관련 항목 발견`, this.debugMode);
          
          // 다중 항목을 위한 특수 처리
          return this.createHoverForEntries(matchedEntries, key);
        }
      }
    }
    
    if (matchedEntries.length > 0) {
      this.log(`호버: ${matchedEntries.length}개 항목 일치`, this.debugMode);
      return this.createHoverForEntries(matchedEntries, key);
    }
    
    this.log(`호버: 키 "${key}"에 대한 일치 항목이 없음`, this.debugMode);
    
    // 좀 더 보기 좋은 "번역 없음" 메시지
    const content = new vscode.MarkdownString();
    content.isTrusted = true;
    content.appendMarkdown(`## 🌐 I18n: \`${key}\`\n\n`);
    content.appendMarkdown(`---\n\n`);
    content.appendMarkdown(`> ⚠️ **이 키에 대한 번역을 찾을 수 없습니다.**\n\n`);
    
    if (isDynamicKey) {
      content.appendMarkdown(`> ℹ️ *동적 변수가 포함된 키입니다. 변수에 따라 다른 번역이 사용될 수 있습니다.*\n\n`);
    }
    
    return new vscode.Hover(content);
  }
  
  /**
   * 문서와 위치 정보로부터 I18n 키 추출
   */
  private extractKeyFromPosition(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    lineText: string, 
    wordUnderCursor: string
  ): string | null {
    // 커서 위치 기준으로 I18n.t 호출 찾기
    let key = this.extractI18nKeyAtPosition(lineText, position.character);
    
    // 키를 찾지 못한 경우 추가 대안 시도
    if (!key) {
      // 전체 라인에서 키 추출 시도
      key = this.extractI18nKey(lineText);
      
      // 커서 위치에 따라 찾기 시도 - I18n.t 호출인 경우에만
      if (!key && wordUnderCursor && wordUnderCursor.includes('.') && 
          (lineText.includes('I18n.t') || lineText.includes('t('))) {
        this.log(`호버: 단어에서 키 추출 시도 - ${wordUnderCursor}`, this.debugMode);
        key = wordUnderCursor;
      }
    }
    
    return key;
  }
  
  /**
   * 여러 언어의 번역을 포함한 호버 생성
   */
  private createHoverForEntries(entries: I18nEntry[], key: string): vscode.Hover {
    // 호버 콘텐츠 생성
    const content = this.createHoverContent(entries, key);
    
    return new vscode.Hover(content);
  }
  
  /**
   * 호버 콘텐츠 생성
   */
  private createHoverContent(entries: I18nEntry[], key: string): vscode.MarkdownString {
    const content = new vscode.MarkdownString();
    content.isTrusted = true;
    
    // 호버 제목 추가
    this.addHoverTitle(content, key);
    
    // 언어별 그룹화
    const langGroups = this.groupEntriesByLanguage(entries);
    
    // 구분선 추가
    content.appendMarkdown(`---\n\n`);
    
    // 언어 그룹별로 항목 추가
    this.addLanguageGroupsToContent(content, langGroups, key);
    
    // 동적 키 처리 (변수가 포함된 경우 도움말 추가)
    if (key.includes('#{')) {
      content.appendMarkdown(`\n\n---\n\n`);
      content.appendMarkdown(`> ℹ️ *동적 변수가 포함된 키입니다. 변수 값에 따라 다른 번역이 사용될 수 있습니다.*\n\n`);
    }
    
    return content;
  }
  
  /**
   * 호버 제목 추가
   */
  private addHoverTitle(content: vscode.MarkdownString, key: string): void {
    // 간결한 키 표시
    const keyParts = key.split('.');
    let displayKey = key;
    
    // 키가 너무 길면 간결하게 표시
    if (keyParts.length > 3 && key.length > 40) {
      const lastParts = keyParts.slice(-2).join('.');
      displayKey = `...${lastParts}`;
    }
    
    // 이모지와 함께 제목 표시 (🌐: 세계/국제화 이모지)
    content.appendMarkdown(`## 🌐 I18n: \`${displayKey}\`\n\n`);
    
    // 전체 키 경로 표시 (축약된 경우)
    if (displayKey !== key) {
      content.appendMarkdown(`전체 경로: \`${key}\`\n\n`);
    }
  }
  
  /**
   * 항목을 언어별로 그룹화
   */
  private groupEntriesByLanguage(entries: I18nEntry[]): {[lang: string]: I18nEntry[]} {
    const langGroups: {[lang: string]: I18nEntry[]} = {};
    
    entries.forEach(entry => {
      if (entry.lang) {
        if (!langGroups[entry.lang]) {
          langGroups[entry.lang] = [];
        }
        langGroups[entry.lang].push(entry);
      }
    });
    
    return langGroups;
  }
  
  /**
   * 언어 그룹별로 항목을 콘텐츠에 추가
   */
  private addLanguageGroupsToContent(
    content: vscode.MarkdownString, 
    langGroups: {[lang: string]: I18nEntry[]}, 
    key: string
  ): void {
    const languageCodes = this.getLanguageCodes();
    
    // 언어별 국기 이모지 매핑
    const flagEmoji: {[key: string]: string} = {
      'ko': '🇰🇷',
      'en': '🇺🇸',
      'ja': '🇯🇵',
      'zh': '🇨🇳',
      'fr': '🇫🇷',
      'de': '🇩🇪',
      'es': '🇪🇸'
    };
    
    // 설정된 언어 순서대로 표시
    let isFirst = true;
    languageCodes.forEach(lang => {
      if (langGroups[lang]) {
        // 첫 번째가 아니면 구분선 추가
        if (!isFirst) {
          content.appendMarkdown(`\n\n`);
        }
        isFirst = false;
        
        // 국기 이모지와 함께 언어 표시
        const emoji = flagEmoji[lang] || '';
        content.appendMarkdown(`### ${emoji} ${lang.toUpperCase()}\n\n`);
        
        this.addEntriesToContent(content, langGroups[lang], key);
      }
    });
    
    // 설정에 없는 언어도 표시
    Object.keys(langGroups).forEach(lang => {
      if (!languageCodes.includes(lang)) {
        // 첫 번째가 아니면 구분선 추가
        if (!isFirst) {
          content.appendMarkdown(`\n\n`);
        }
        isFirst = false;
        
        const emoji = flagEmoji[lang] || '🌐';
        content.appendMarkdown(`### ${emoji} ${lang.toUpperCase()}\n\n`);
        
        this.addEntriesToContent(content, langGroups[lang], key);
      }
    });
  }
  
  /**
   * 항목들을 콘텐츠에 추가
   */
  private addEntriesToContent(
    content: vscode.MarkdownString, 
    entries: I18nEntry[], 
    key: string
  ): void {
    entries.forEach((entry, index) => {
      if (index > 0) {
        // 다중 번역이 있는 경우 구분선 추가
        content.appendMarkdown(`\n\n---\n\n`);
      }
      
      // 키 경로 정보 추가 (일치하지 않는 경우)
      if (entry.key !== key) {
        content.appendMarkdown(`📌 키: \`${entry.key}\`\n\n`);
      }
      
      // 값 표시 (너무 길면 잘라서)
      let displayValue = entry.value;
      if (entry.value && entry.value.length > 150) {
        displayValue = entry.value.substring(0, 147) + '...';
      }
      
      // 인용구로 번역 값 표시하여 강조 (더 큰 글씨로 표시)
      content.appendMarkdown(`> 💬 **${displayValue}**\n\n`);
      
      // 파일 경로 표시 (너무 길면 잘라서)
      let displayPath = entry.file;
      if (displayPath.length > 40) {
        const parts = displayPath.split('/');
        if (parts.length > 3) {
          displayPath = `.../${parts.slice(-3).join('/')}`;
        }
      }
      
      // 파일 위치 정보 표시
      if (entry.fileLine !== undefined) {
        const lineNumber = typeof entry.fileLine === 'number' ? entry.fileLine : 1;
        content.appendMarkdown(`📁 *${displayPath}:${lineNumber}*`);
      } else {
        content.appendMarkdown(`📁 *${displayPath}*`);
      }
    });
  }
  
  /**
   * I18n.t 호출에서 키 추출 (전체 라인 기준)
   */
  private extractI18nKey(text: string): string | null {
    // I18n.t 또는 t() 호출이 있는지 확인
    if (!text.includes('I18n.t') && !text.includes('t(') && !text.includes('i18n.t[')) {
      return null;
    }
    
    // 키 추출 패턴 목록
    const patterns = [
      /I18n\.t\s*\(\s*["']([^"']+)["']\s*\)/,                // I18n.t("key")
      /t\s*\(\s*["']([^"']+)["']\s*\)/,                      // t("key")
      /I18n\.t\s*\(\s*["']([^"']+)["']\s*,.+\)/,            // I18n.t("key", {...})
      /t\s*\(\s*["']([^"']+)["']\s*,.+\)/,                  // t("key", {...})
      /i18n\.t\s*\[\s*["']([^"']+)["']\s*\]/,               // i18n.t["key"]
      /I18n\.t\s*\[\s*["']([^"']+)["']\s*\]/,               // I18n.t["key"]
      /["']([^"'\.]+\.[^"'\.]+\.[^"'\.]+)["']/              // "a.b.c" 패턴
    ];
    
    // 각 패턴으로 키 추출 시도
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * 커서 위치에 따라 I18n.t 호출에서 키 추출
   */
  private extractI18nKeyAtPosition(text: string, position: number): string | null {
    // 라인에 있는 모든 I18n.t 호출 찾기
    const i18nCalls = this.findAllI18nCalls(text);
    
    // 커서 위치에 포함된 호출 찾기
    for (const call of i18nCalls) {
      if (position >= call.start && position <= call.end) {
        return call.key;
      }
    }
    
    // 정확히 포함되지 않으면 가장 가까운 호출 찾기
    if (i18nCalls.length > 0) {
      let closestCall = i18nCalls[0];
      let minDistance = Math.abs(position - (closestCall.start + closestCall.end) / 2);
      
      for (let i = 1; i < i18nCalls.length; i++) {
        const call = i18nCalls[i];
        const distance = Math.abs(position - (call.start + call.end) / 2);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestCall = call;
        }
      }
      
      return closestCall.key;
    }
    
    return null;
  }
  
  /**
   * 문자열에서 모든 I18n.t 호출 찾기
   */
  private findAllI18nCalls(text: string): Array<{key: string, start: number, end: number}> {
    const calls: Array<{key: string, start: number, end: number}> = [];
    
    // I18n.t 호출 패턴 정의
    const patterns = [
      { regex: /I18n\.t\s*\(\s*["']([^"']+)["']\s*\)/g, group: 1 },                 // I18n.t("key")
      { regex: /I18n\.t\s*\(\s*["']([^"']+)["']\s*,.+?\)/g, group: 1 },             // I18n.t("key", {...})
      { regex: /t\s*\(\s*["']([^"']+)["']\s*\)/g, group: 1 },                       // t("key")
      { regex: /t\s*\(\s*["']([^"']+)["']\s*,.+?\)/g, group: 1 },                   // t("key", {...})
      { regex: /i18n\.t\s*\[\s*["']([^"']+)["']\s*\]/g, group: 1 },                 // i18n.t["key"]
      { regex: /I18n\.t\s*\[\s*["']([^"']+)["']\s*\]/g, group: 1 }                  // I18n.t["key"]
    ];
    
    // 각 패턴으로 호출 찾기
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const key = match[pattern.group];
        const start = match.index;
        const end = start + match[0].length;
        
        calls.push({ key, start, end });
      }
    }
    
    // 시작 위치 기준으로 정렬
    return calls.sort((a, b) => a.start - b.start);
  }

  /**
   * 정의 제공 (Go to Definition)
   */
  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
    this.updateDebugMode();
    this.log('정의 제공 호출됨', true);
    
    // 1. 키 추출 
    const lineText = document.lineAt(position).text;
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_\.]+/);
    let key: string | null = null;
    
    if (wordRange) {
      // 먼저 커서 위치에서 정확한 키 추출 시도
      key = this.extractI18nKeyAtPosition(lineText, position.character);
      
      if (!key) {
        // 전체 라인에서 키 추출 시도
        key = this.extractI18nKey(lineText);
        
        // 그래도 없으면 커서 아래 단어를 사용 (단, '.'이 포함된 경우만)
        if (!key) {
          const wordUnderCursor = document.getText(wordRange);
          if (wordUnderCursor && wordUnderCursor.includes('.')) {
            key = wordUnderCursor;
            this.log(`정의 제공: 단어에서 키 추출 - ${key}`, this.debugMode);
          }
        }
      }
    }
    
    if (!key) {
      this.log('정의 제공: 키를 추출할 수 없음', this.debugMode);
      return undefined;
    }
    
    this.log(`정의 제공: 키 "${key}" 검색`, this.debugMode);
    
    // 2. 로케일 항목 확인
    const entries = this.localesScanner.getEntries();
    if (entries.length === 0) {
      this.log('정의 제공: 항목 없음, 먼저 스캔 필요', true);
      return undefined;
    }
    
    // 3. 정확한 키 매칭 (strict matching)
    const locations = this.findExactMatchLocations(entries, key);
    if (locations.length > 0) {
      return locations;
    }
    
    // 4. 대체 키 시도
    const altLocations = this.findAlternativeKeyLocations(entries, key);
    if (altLocations.length > 0) {
      return altLocations;
    }
    
    this.log(`정의 제공: "${key}"에 대한 정의를 찾을 수 없음`, this.debugMode);
    return undefined;
  }
  
  /**
   * 정확한 키 매칭 위치 찾기
   */
  private findExactMatchLocations(entries: I18nEntry[], key: string): vscode.Location[] {
    const exactMatches = entries.filter(entry => {
      const isMatch = entry.key === key && entry.file && entry.fileLine !== undefined;
      if (isMatch) {
        this.log(`정의 제공: 정확한 일치 - ${entry.key} (${entry.lang || '언어 없음'}) 파일: ${entry.file}`, this.debugMode);
      }
      return isMatch;
    });
    
    if (exactMatches.length > 0) {
      const locations = exactMatches.map(entry => this.createLocation(entry));
      this.log(`정의 제공: ${exactMatches.length}개의 정확한 매칭 발견`, this.debugMode);
      return locations;
    }
    
    return [];
  }
  
  /**
   * 대체 키 위치 찾기
   */
  private findAlternativeKeyLocations(entries: I18nEntry[], key: string): vscode.Location[] {
    let alternativeKey: string | null = null;
    const languageCodes = this.getLanguageCodes();
    
    // 언어 코드가 포함된 키인지 확인 (예: "ko.user.name" -> "user.name")
    const langKeyMatch = key.match(/^([a-z]{2})\.(.+)$/i);
    if (langKeyMatch && languageCodes.includes(langKeyMatch[1].toLowerCase())) {
      alternativeKey = langKeyMatch[2];
      this.log(`정의 제공: 언어 코드 제거 후 대체 키 - ${alternativeKey}`, this.debugMode);
    }
    // 언어 코드를 앞에 붙여보기 (예: "user.name" -> "ko.user.name")
    else {
      for (const langCode of languageCodes) {
        const altKey = `${langCode}.${key}`;
        const altMatches = entries.filter(entry => 
          entry.key === altKey && entry.file && entry.fileLine !== undefined
        );
        
        if (altMatches.length > 0) {
          alternativeKey = altKey;
          this.log(`정의 제공: 언어 코드 추가 후 대체 키 - ${alternativeKey}`, this.debugMode);
          break;
        }
      }
    }
    
    // 대체 키로 다시 검색
    if (alternativeKey) {
      const altMatches = entries.filter(entry => 
        entry.key === alternativeKey && entry.file && entry.fileLine !== undefined
      );
      
      if (altMatches.length > 0) {
        const locations = altMatches.map(entry => this.createLocation(entry));
        this.log(`정의 제공: ${altMatches.length}개의 대체 키 매칭 발견`, this.debugMode);
        return locations;
      }
    }
    
    return [];
  }
  
  /**
   * 항목에서 위치 객체 생성
   */
  private createLocation(entry: I18nEntry): vscode.Location {
    const fileUri = vscode.Uri.file(entry.file);
    const lineNumber = typeof entry.fileLine === 'number' ? Math.max(0, entry.fileLine - 1) : 0;
    
    return new vscode.Location(fileUri, new vscode.Position(lineNumber, 0));
  }
} 