import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface I18nEntry {
  key: string;
  value: string;
  file: string;
  lang?: string; // 언어 코드 추가
  fileLine?: number; // 파일 내 위치를 위한 라인 번호 추가
}

export class I18nLocalesScanner {
  private i18nEntries: I18nEntry[] = [];
  private outputChannel: vscode.OutputChannel;
  private debugMode: boolean = false;
  
  constructor(outputChannel: vscode.OutputChannel) {
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
   * 모든 로케일 파일 스캔
   */
  public async scanLocaleFiles(): Promise<I18nEntry[]> {
    // 디버그 모드 업데이트
    this.updateDebugMode();
    
    this.i18nEntries = [];
    
    // 설정에서 로케일 경로 가져오기
    const config = vscode.workspace.getConfiguration('rails-i18n');
    let localesPaths: string[] = config.get('localesPaths') || ['config/locales'];
    
    // tmp 폴더는 스캔하지 않도록 필터링
    localesPaths = localesPaths.filter(path => !path.includes('tmp'));
    
    this.log(`로케일 경로 설정: ${localesPaths.join(', ')}`, true);
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.log('워크스페이스 폴더를 찾을 수 없습니다.', true);
      return this.i18nEntries;
    }
    
    // 로케일 파일 스캔
    await this.scanWorkspaceFolders(workspaceFolders, localesPaths);
    
    // 후처리
    this.removeDuplicateEntries();
    this.normalizeI18nKeys();
    
    this.log(`총 ${this.i18nEntries.length}개의 I18n 키를 찾았습니다.`, true);
    this.logScanResults();
    
    return this.i18nEntries;
  }
  
  /**
   * 스캔 결과 로그 출력
   */
  private logScanResults(): void {
    // 시작하는 키를 몇 개 출력
    if (this.i18nEntries.length === 0) {
      return;
    }
    
    this.log('첫 번째 항목들:', true);
    for (let i = 0; i < Math.min(5, this.i18nEntries.length); i++) {
      this.log(`  ${i+1}. ${this.i18nEntries[i].key} = ${this.i18nEntries[i].value} [${this.i18nEntries[i].lang || '언어 없음'}]`, true);
    }
    
    // 언어별 항목 통계
    const langStats = this.getLanguageStatistics();
    
    this.log('언어별 항목 수:', true);
    Object.entries(langStats).forEach(([lang, count]) => {
      this.log(`  - ${lang}: ${count}개`, true);
    });
  }
  
  /**
   * 언어별 항목 통계 계산
   */
  private getLanguageStatistics(): Record<string, number> {
    const langStats: Record<string, number> = {};
    
    this.i18nEntries.forEach(entry => {
      if (entry.lang) {
        langStats[entry.lang] = (langStats[entry.lang] || 0) + 1;
      } else {
        langStats['unknown'] = (langStats['unknown'] || 0) + 1;
      }
    });
    
    return langStats;
  }
  
  /**
   * 워크스페이스 폴더들에서 로케일 파일 스캔
   */
  private async scanWorkspaceFolders(
    workspaceFolders: readonly vscode.WorkspaceFolder[],
    localesPaths: string[]
  ): Promise<void> {
    for (const workspaceFolder of workspaceFolders) {
      for (const localesPath of localesPaths) {
        const fullPath = path.join(workspaceFolder.uri.fsPath, localesPath);
        
        this.log(`전체 경로 탐색: ${fullPath}`, this.debugMode);
        
        if (fs.existsSync(fullPath)) {
          this.log(`경로 존재, 스캔 시작: ${fullPath}`, this.debugMode);
          await this.scanDirectory(fullPath);
        } else {
          this.log(`경로가 존재하지 않습니다: ${fullPath}`, true);
        }
      }
    }
  }
  
  /**
   * 로케일 디렉토리 스캔
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          await this.scanDirectory(filePath);
        } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
          // 파일명에서 언어 코드 추출 (예: ko.string.yml -> ko)
          const langMatch = file.match(/^([a-z]{2})[\._]/i);
          const lang = langMatch ? langMatch[1] : this.getLangFromFileName(file);
          
          await this.parseYamlFile(filePath, lang);
        }
      }
    } catch (err) {
      console.error(`스캔 중 오류 발생: ${err}`);
      this.log(`스캔 중 오류 발생: ${err}`, true);
    }
  }
  
  /**
   * 파일 이름에서 언어 코드 추출
   */
  private getLangFromFileName(fileName: string): string | undefined {
    const langMatch = fileName.match(/^([a-z]{2})[_\.]/i);
    return langMatch ? langMatch[1].toLowerCase() : undefined;
  }
  
  /**
   * YAML 파일 파싱
   */
  private async parseYamlFile(filePath: string, lang?: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 파일 이름에서 언어 코드 추출 (lang이 없을 경우)
      if (!lang) {
        const fileName = path.basename(filePath);
        lang = this.getLangFromFileName(fileName);
        if (lang) {
          this.log(`파일 이름에서 언어 코드 추출: ${lang} (${fileName})`, this.debugMode);
        }
      }
      
      try {
        const parsed = yaml.parse(content, { strict: false });
        
        if (parsed) {
          // 각 키의 위치 정보 추출
          const keyPositions = this.extractKeyPositions(content);
          
          // YAML 객체를 평탄화하여 모든 키-값 쌍을 추출
          this.flattenYaml(parsed, '', filePath, lang, keyPositions);
        }
      } catch (parseErr) {
        console.warn(`YAML 파싱 경고 (부분 파싱 시도): ${filePath}, ${parseErr}`);
        this.log(`YAML 파싱 경고: ${filePath}, ${parseErr}`, true);
        
        // 오류 행을 로그에 표시
        if (parseErr instanceof yaml.YAMLParseError) {
          this.log(`오류 위치: ${parseErr.pos[0]}행, ${parseErr.pos[1]}열`, true);
        }
        
        // 부분 파싱 시도 - 라인별로 처리
        this.attemptPartialParsing(content, filePath, lang);
      }
    } catch (err) {
      console.error(`파일 읽기 오류: ${filePath}, ${err}`);
      this.log(`파일 읽기 오류: ${filePath}, ${err}`, true);
    }
  }
  
  /**
   * YAML 파일에서 키의 위치 정보 추출
   */
  private extractKeyPositions(content: string): Map<string, number> {
    const keyPositions = new Map<string, number>();
    const lines = content.split('\n');
    const keyStack: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 빈 줄이나 주석은 무시
      if (line === '' || line.startsWith('#')) {
        continue;
      }
      
      // 키-값 쌍 찾기
      const match = line.match(/^(\s*)([^:]+):\s*(.*)?$/);
      if (match) {
        const indentLevel = match[1].length;
        const key = match[2].trim();
        const value = match[3] ? match[3].trim() : '';
        
        // 들여쓰기 기반으로 키 스택 관리
        while (keyStack.length > 0 && indentLevel <= keyStack.length * 2) {
          keyStack.pop();
        }
        
        keyStack.push(key);
        
        // 값이 비어 있지 않으면 완전한 키 경로를 기록
        if (value !== '' && value !== '~') {
          const fullKey = keyStack.join('.');
          keyPositions.set(fullKey, i + 1); // 1-based 라인 번호
        }
      }
    }
    
    return keyPositions;
  }
  
  /**
   * YAML 파싱에 실패한 경우 부분적으로 파싱 시도
   */
  private attemptPartialParsing(content: string, filePath: string, lang?: string): void {
    // 각 섹션별로 파싱 시도
    const lines = content.split('\n');
    let currentSections: string[] = [];
    let currentIndent = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimRight();
      
      // 빈 줄이나 주석은 무시
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      }
      
      // 키-값 쌍 확인
      const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
      if (match) {
        const [, indentStr, key, valueStr] = match;
        const indent = indentStr.length;
        
        // 현재 들여쓰기 레벨 처리
        if (indent <= currentIndent) {
          // 이전 섹션에서 빠져나옴
          const diff = Math.floor((currentIndent - indent) / 2) + 1;
          currentSections = currentSections.slice(0, -diff);
        }
        
        currentIndent = indent;
        const cleanKey = key.trim();
        
        // 값이 없거나 빈 문자열이면 섹션
        if (!valueStr.trim() || valueStr.trim() === '~') {
          currentSections.push(cleanKey);
        } else {
          // 값이 있으면 바로 항목 추가
          const processedValue = this.processValue(valueStr.trim());
          if (processedValue !== null) {
            const fullKey = [...currentSections, cleanKey].join('.');
            this.i18nEntries.push({
              key: fullKey,
              value: processedValue,
              file: filePath,
              lang,
              fileLine: i + 1
            });
          }
        }
      }
    }
  }
  
  /**
   * 중복된 키 부분 정규화
   */
  private normalizeDuplicateKeyParts(key: string): string {
    const parts = key.split('.');
    const normalizedParts: string[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      // 이전에 동일한 부분이 연속해서 나오는 경우 건너뛰기
      if (i > 0 && parts[i] === parts[i-1]) {
        continue;
      }
      normalizedParts.push(parts[i]);
    }
    
    return normalizedParts.join('.');
  }
  
  /**
   * YAML 값 문자열 처리
   */
  private processValue(valueStr: string): string | null {
    valueStr = valueStr.trim();
    
    // 따옴표로 둘러싸인 경우
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || 
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.substring(1, valueStr.length - 1);
    }
    
    // 일반 문자열
    if (valueStr !== '') {
      return valueStr;
    }
    
    return null;
  }
  
  /**
   * 중첩된 YAML 객체를 평탄화
   */
  private flattenYaml(obj: any, prefix: string, filePath: string, lang?: string, keyPositions?: Map<string, number>): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    // 파일명에서 언어 코드 추출 (이미 있으면 무시)
    if (!lang) {
      const fileName = path.basename(filePath);
      lang = this.getLangFromFileName(fileName);
    }
    
    // 루트 레벨에서 언어 코드 확인
    if (prefix === '') {
      // 루트 레벨 키가 언어 코드인 경우 (ko: { ticket: { ... } })
      for (const key in obj) {
        if (this.isLanguageCode(key) && typeof obj[key] === 'object') {
          // 언어 코드를 prefix 없이 하위 객체로 직접 처리
          this.flattenYaml(obj[key], '', filePath, key.toLowerCase(), keyPositions);
          delete obj[key]; // 처리 후 제거하여 중복 방지
        }
      }
    }
    
    // 나머지 키 처리
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        
        // 새 키 생성
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        // 중복 키 부분 정규화
        const normalizedKey = this.normalizeDuplicateKeyParts(newKey);
        
        // 값이 객체인 경우 재귀 처리
        if (value !== null && typeof value === 'object') {
          this.flattenYaml(value, normalizedKey, filePath, lang, keyPositions);
        } 
        // 값이 primitive 타입인 경우 항목 추가
        else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          // 비정상적으로 긴 키는 처리하지 않음
          if (normalizedKey.length > 200) {
            this.log(`경고: 키가 너무 깁니다 (${normalizedKey.length}자) - ${normalizedKey.substring(0, 50)}...`, this.debugMode);
            continue;
          }
          
          // 키 위치 확인 (정확한 라인 번호)
          let fileLine = this.findLineNumber(keyPositions, normalizedKey);
          
          this.i18nEntries.push({
            key: normalizedKey,
            value: String(value),
            file: filePath,
            lang,
            fileLine
          });
        }
      }
    }
  }
  
  /**
   * 언어 코드인지 확인
   */
  private isLanguageCode(key: string): boolean {
    return /^[a-z]{2}$/i.test(key);
  }
  
  /**
   * 키에 대한 라인 번호 찾기
   */
  private findLineNumber(keyPositions?: Map<string, number>, key?: string): number | undefined {
    if (!keyPositions || !key) {
      return undefined;
    }
    
    // 정확한 키 매칭
    if (keyPositions.has(key)) {
      return keyPositions.get(key);
    }
    
    // 부분 키로 시도
    if (key.includes('.')) {
      const keyParts = key.split('.');
      const lastTwoParts = keyParts.slice(-2).join('.');
      
      // 역순으로 매칭 시도 (더 긴 매치 우선)
      for (const [posKey, posLine] of keyPositions.entries()) {
        if (posKey.endsWith(lastTwoParts)) {
          return posLine;
        }
      }
      
      // 마지막 부분만 시도
      const lastPart = keyParts[keyParts.length - 1];
      for (const [posKey, posLine] of keyPositions.entries()) {
        if (posKey.endsWith(lastPart)) {
          return posLine;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * 모든 I18n 항목 가져오기
   */
  public getEntries(): I18nEntry[] {
    return this.i18nEntries;
  }
  
  /**
   * 특정 언어의 I18n 항목 가져오기
   */
  public getEntriesByLang(lang: string): I18nEntry[] {
    return this.i18nEntries.filter(entry => entry.lang === lang);
  }
  
  /**
   * 키 검색
   */
  public findByKey(key: string): I18nEntry[] {
    // 정확히 일치하는 항목 먼저 찾기
    const exactMatches = this.i18nEntries.filter(entry => entry.key === key);
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    // 동적 키 처리 (#{...} 형태의 변수가 포함된 경우)
    if (key.includes('#{')) {
      // 변수 부분 이전까지의 기본 키 추출
      const baseKey = key.split('#{')[0].replace(/\.$/, ''); // 마지막 점 제거
      if (baseKey.length > 0) {
        // 기본 키로 시작하는 항목 검색
        const baseMatches = this.i18nEntries.filter(entry => 
          entry.key.startsWith(baseKey)
        );
        
        if (baseMatches.length > 0) {
          // 키 길이가 가장 비슷한 것 하나만 반환
          return [baseMatches.sort((a, b) => 
            Math.abs(a.key.length - key.length) - Math.abs(b.key.length - key.length)
          )[0]];
        }
      }
    }

    // 관련 키가 없는 경우 빈 배열 반환
    return [];
  }
  
  /**
   * 정확한 키로 검색 (언어 우선순위 반영)
   */
  public findExactKey(key: string, preferredLang?: string): I18nEntry | undefined {
    // 선호하는 언어가 있으면 해당 언어로 먼저 찾기
    if (preferredLang) {
      const preferredEntry = this.i18nEntries.find(
        entry => entry.key === key && entry.lang === preferredLang
      );
      if (preferredEntry) {
        return preferredEntry;
      }
    }
    
    // 선호하는 언어로 찾지 못한 경우 모든 항목에서 검색
    return this.i18nEntries.find(entry => entry.key === key);
  }
  
  /**
   * 중복 항목 제거
   */
  private removeDuplicateEntries(): void {
    const uniqueMap = new Map<string, I18nEntry>();
    
    // 언어 코드와 키로 유니크한 항목 저장
    for (const entry of this.i18nEntries) {
      const uniqueKey = `${entry.lang || 'unknown'}_${entry.key}`;
      uniqueMap.set(uniqueKey, entry);
    }
    
    this.i18nEntries = Array.from(uniqueMap.values());
  }
  
  /**
   * 키에서 언어 코드 정규화
   */
  private normalizeI18nKeys(): void {
    const updatedEntries: I18nEntry[] = [];
    
    for (const entry of this.i18nEntries) {
      // 키가 언어 코드로 시작하는 경우 (en.ticket.action.retry1)
      const keyMatch = entry.key.match(/^([a-z]{2})\.(.+)$/i);
      if (keyMatch) {
        const langFromKey = keyMatch[1].toLowerCase();
        const normalizedKey = keyMatch[2];
        
        // 언어 코드가 없거나 키에서 추출한 코드와 다른 경우에만 업데이트
        if (!entry.lang || entry.lang !== langFromKey) {
          updatedEntries.push({
            ...entry,
            key: normalizedKey,
            lang: langFromKey
          });
          continue;
        }
      }
      
      updatedEntries.push(entry);
    }
    
    this.i18nEntries = updatedEntries;
  }
} 