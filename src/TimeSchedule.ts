import { isAsyncFunction } from './types.ts';

type ScheduleDate = Date | number | void | null | undefined;

type AsyncScheduleFunction<T, R> = (p: T) => Promise<R>;
type SyncScheduleFunction<T, R> = (p: T) => R;

export type ScheduleFunction = AsyncScheduleFunction<number, ScheduleDate> | SyncScheduleFunction<number, ScheduleDate>;

type TimeTableItem = {
  date: number,
  callback: ScheduleFunction,
}

/**
 * TODO: registerCallback 과 registerTime 는 callback 을 키로 제어하고 있기 때문에 하나의 객체로 만들어 두는 것이 좋을 것 같다.
 */
export default class TimeSchedule {
  registerCallback = new Map<ScheduleFunction, AsyncScheduleFunction<number, ScheduleDate>>()

  registerTime: TimeTableItem[] = [];

  intervalHandler: ReturnType<typeof setTimeout> | undefined = undefined;

  readonly checkTime;

  constructor(checkTime = 1_000) {
    this.checkTime = checkTime;
  }

  /**
   * 스케줄 간격으로 실행 시킬 프로세스
   */
  invokeScheduleProcess = async () => {
    if (this.registerTime.length === 0) return;

    // 아직 실행이 이루어지지 않은 스케줄 리스트
    const remainList: TimeTableItem[] = [];

    const now = Date.now(); // 하위 로직에서 매번 Date.now() 하지 않게 하기 위해 사전에 미리 현재시간을 저장함.

    // 1️⃣ 실행되어야 하는 스케줄 함수들 필터링
    const runnableList = this.registerTime
      .filter((data) => {
        if (data.date <= now) {
          return true;
        }
        remainList.push(data);
        return false;
      });

    if (runnableList.length === 0) return;
    this.registerTime = remainList;

    // 2️⃣ 🏃‍♂️실행
    const runResult = runnableList.map(async (tb) => {
      const asyncFunc = this.registerCallback.get(tb.callback);
      const nextDate = await asyncFunc?.(tb.date);

      return {
        date: nextDate,
        callback: tb.callback,
      };
    });

    // 3️⃣ 실행서 받은 추출
    const ret = await Promise.all(runResult) as TimeTableItem[];

    // 4️⃣ 실행 결과 재등록(date 가 있는 결과)이 되는 결과와 스케줄에 남아 있는 내용을 정리하여 timeTable 에 설정
    const list = ret.concat(this.registerTime);
    this.registerTime = list.filter((item) => item.date);
    this.registerCallback = list.reduce((newCallback, item) => {
      const value = this.registerCallback.get(item.callback);
      if (value && item.date) newCallback.set(item.callback, value);
      return newCallback;
    }, new Map<ScheduleFunction, AsyncScheduleFunction<number, ScheduleDate>>());
  }

  /**
   * 문자로 된 is8601 의 시간대를 unix 시간으로 바꿔 {@link registerTime} 에 넣고 시간 순서대(오름차순)로 정렬 한다.
   * @example
   * ```javascript
   * pushScheduleContext(()=>{...}); // 현재시간을 한개 추가한다. 즉, 스케줄 체크 시 바로 실행됨.
   * pushScheduleContext(()=>{...}, ['2024-12-12 12:12:12', Date.now(), new Date('2024-12-12 12:12:15')]);  // 복수의 시간값
   * pushScheduleContext(()=>{...}, Date.now()); // 단일 시간값
   * ```
   * @param callback 시간이 되면 실행 시킬 함수
   * @param times string: iso8601 표준에 문자열, number: unix timestamp, Date: javascript Date 객체
   */
  setScheduleContext(callback: ScheduleFunction, times: (number | string | Date)[]|(number | string | Date)) {
    if (this.registerCallback.has(callback)) return;

    let t: Array<(number | string | Date)>;

    if (times === undefined) {
      t = [Date.now()];
    } else
    if (times instanceof Array) {
      t = times;
    } else {
      t = [times];
    }

    // 콜백 함수등록
    const cb = isAsyncFunction(callback)
      ? callback
      : (date: number) => new Promise<ScheduleDate>((resolve) => { // 동기함수를 모두 비동기 함수로 변환한다.
        resolve(callback(date));
      });
    this.registerCallback.set(callback, cb as AsyncScheduleFunction<number, ScheduleDate>);

    // 시간 테이블 등록
    const retTime = t.map((time) => {
      let date;
      if (typeof time === 'string') {
        date = new Date(time).getTime();
      } else if (time instanceof Date) {
        date = time.getTime();
      } else {
        date = time;
      }

      return ({
        date,
        callback,
      });
    });

    this.registerTime = this.registerTime.concat(retTime);
  }

  /**
   * 스케줄에 등록된 콜백함수 제거
   * @param callback 삭제할 콜백 함수
   */
  removeScheduleContext(callback: ScheduleFunction) {
    this.registerCallback.delete(callback);
    this.registerTime = this.registerTime.filter((item) => item.callback !== callback);
  }

  /**
   * 사용방법은 {@link setScheduleContext} 와 같으니 이전에 설정되었던 callBack 으로 등록된 스케줄을 삭제하고 새로 설정한다.
   * @param callback 등록할 함수의 이름
   * @param times 등록할 시간 리스트
   */
  updateScheduleContext(callback: ScheduleFunction, times: (string | Date | number)[]|(string | Date | number)) {
    this.removeScheduleContext(callback);
    this.setScheduleContext(callback, times);
  }

  static cleanup(handler: ReturnType<typeof setInterval>) {
    if (handler) clearInterval(handler);
  }

  // TODO : 테스트 필요.TimeSchedule endSchedule 없이 인스턴스 해제될때 호출 되는지 여부 확인
  finalization = new FinalizationRegistry(TimeSchedule.cleanup);

  /**
   * Timer interval 시작
   * @return 자원을 clear 시키는 함수 반환
   */
  startSchedule() {
    if (!this.intervalHandler) {
      this.intervalHandler = setInterval(this.invokeScheduleProcess, this.checkTime);
      this.finalization.register(this, this.intervalHandler, this);
    }
    return () => this.endSchedule();
  }

  /**
   * 사용하고 있는 자원을 clear 한다.
   */
  endSchedule() {
    clearInterval(this.intervalHandler);
    delete this.intervalHandler;
    this.finalization.unregister(this);
  }

  /**
   * 타임스케줄의 상태를 확인
   */
  status() {
    return {
      run: this.intervalHandler !== undefined,
      list: [], // TODO: 목록 리스트의 키와 절대시간 구조
    };
  }
}
