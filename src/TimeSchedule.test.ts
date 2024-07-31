import {
  beforeEach,
  expect,
  it,
  afterEach,
  assert,
  describe,
  vi,
} from 'vitest';
import TimeSchedule from './TimeSchedule';

/**
 * TimeSchedule 를 상속하여 테스트를 위한 method 를 추가한다.
 */
class TimeScheduleTest extends TimeSchedule {
  getRegister() {
    return {
      time: this.registerTime,
      callback: this.registerCallback,
    };
  }
}

const SCHEDULE_TIME = 1_000;
const timeSchedule = new TimeScheduleTest(SCHEDULE_TIME);

beforeEach(() => {
  console.log('TimeSchedule beforeEach');
  vi.useFakeTimers();
  timeSchedule.startSchedule();
});

afterEach(() => {
  console.log('TimeSchedule afterEach');
  vi.useRealTimers();
  timeSchedule.endSchedule();
});

describe('타임 스케줄 테스트', () => {
  it('타임스케줄 추가할 함수가 동기 함수에 대한 테스트', async () => {
    const HOPE_TIME_STEP = 10_000;
    const initDate = Date.now();

    timeSchedule.setScheduleContext(
      (() => {
        let retry = 0;
        return (expectedTime: number) => {
          if (retry === 3) return null;

          retry += 1;
          expect(expectedTime).toBe(initDate + HOPE_TIME_STEP * retry);
          const gap = expectedTime - Date.now();
          assert(gap >= 0 && gap <= SCHEDULE_TIME, `${retry}회차: 시간이 일치 하지 않습니다.${gap}`);

          return expectedTime + HOPE_TIME_STEP; // next expect time
        };
      })(),
      initDate + HOPE_TIME_STEP,
    );

    await vi.advanceTimersByTimeAsync(40_000);
  });

  it('타임스케줄 추가할 함수가 비동기 함수에 대한 테스트 ', async () => {
    const HOPE_TIME_STEP = 10_000;
    const initDate = Date.now();
    const DELAY_TIME = 3_000;

    // 비동기 테스트
    timeSchedule.setScheduleContext(
      (() => {
        let retry = 0;
        return async (expectedTime) => {
          if (retry === 3) return null;
          retry += 1;

          await new Promise((r) => {
            setTimeout(r, DELAY_TIME);
          });

          expect(expectedTime + DELAY_TIME).toBe(Date.now());
          const gap = expectedTime + DELAY_TIME - Date.now();
          assert(gap >= 0 && gap <= SCHEDULE_TIME, `${retry}회차: 시간이 일치 하지 않습니다.${gap}`);

          return expectedTime + HOPE_TIME_STEP; // next expect time
        };
      })(),
      initDate + HOPE_TIME_STEP,
    );

    await vi.advanceTimersByTimeAsync(40_000);
  });

  it('기 등록된 콜백 함수가 제대로 호출 하는지 테스트', async () => {
    const HOPE_TIME_STEP = 10_000;

    const now = Date.now();

    let runFlag = 'init setting function';

    // 초기 설정된 값
    let variableFunction = () => {
      runFlag = 'first setting function';
    };

    // 타임라인에 들어간 callback
    const callbackKey = () => {
      variableFunction();
    };

    timeSchedule.setScheduleContext(
      callbackKey,
      now + HOPE_TIME_STEP,
    );

    variableFunction = () => {
      runFlag = 'modify function';
    };

    expect(runFlag).toBe('init setting function');
    setTimeout(() => {
      // 희망하는 시간에 문구가 제대로 바꼈는지 확인.
      expect(runFlag).toBe('modify function');
    }, HOPE_TIME_STEP);

    await vi.advanceTimersByTimeAsync(HOPE_TIME_STEP);
  });

  it('콜백함수가 반환하는 시간이 존재 유무에 따른 메모리 잔여 테스트', async () => {
    let toggle = true;
    const callbackKey = (expectedTime: number) => {
      if (toggle) {
        toggle = false;
        return expectedTime + 1_000;
      }
      return null;
    };

    timeSchedule.setScheduleContext(
      callbackKey,
      Date.now() + 1_000,
    );
    expect(timeSchedule.getRegister().time.length).toBe(1);
    expect(timeSchedule.getRegister().callback.size).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(timeSchedule.getRegister().time.length).toBe(1);
    expect(timeSchedule.getRegister().callback.size).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(timeSchedule.getRegister().time.length).toBe(0);
    expect(timeSchedule.getRegister().callback.size).toBe(0);
  });

  it('기존에 등록된 callback 을 update 시 시간이 지연되어 실행 되는지 여부', async () => {
    let complete = false;
    const callbackKey = () => {
      complete = true;
    };

    timeSchedule.updateScheduleContext(callbackKey, Date.now() + 30_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(complete).toBe(false);
    timeSchedule.updateScheduleContext(callbackKey, Date.now() + 30_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(complete).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(complete).toBe(true);
  });

  it('시간이 여러개 등록되었을 때 순차적으로 일어나는가?', async () => {
    let callIndex = 0;
    const now = Date.now();
    const timeTable = [
      now + 1_000,
      now + 2_000,
      now + 3_000,
    ];
    const callbackKey = (expectedTime: number) => {
      expect(expectedTime).toBe(timeTable[callIndex]);
      callIndex += 1;
    };
    timeSchedule.updateScheduleContext(callbackKey, timeTable);
    await vi.advanceTimersByTimeAsync(10_000);
  });

  it('콜백함수가 여러 시간으로 등록되어 있을 때 일부 데이터가 지연으로 재등록되었을 때', async () => {
    let toggle = false;
    const callbackKey = (expectedTime: number) => {
      if (!toggle) {
        // 첫번째 값이 재등록될 때
        toggle = true;
        return expectedTime + 1_000;
      }
      return null;
    };

    timeSchedule.setScheduleContext(
      callbackKey,
      [
        Date.now() + 1_000,
        Date.now() + 3_000,
      ],
    );

    expect(toggle).toBe(false);
    expect(timeSchedule.getRegister().time.length).toBe(2);
    expect(timeSchedule.getRegister().callback.size).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(toggle).toBe(true);
    expect(timeSchedule.getRegister().time.length).toBe(2);
    expect(timeSchedule.getRegister().callback.size).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(timeSchedule.getRegister().time.length).toBe(1);
    expect(timeSchedule.getRegister().callback.size).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(timeSchedule.getRegister().time.length).toBe(0);
    expect(timeSchedule.getRegister().callback.size).toBe(0);
  });

  it('스케줄 콜백에서에서 스케줄 삭제 테스트', async () => {
    // callbackKey 은 5초 간격으로 3회 실행하고 willRemoveFunction 은 1초마다 실행한다.
    // callbackKey 가 최초로 실행 되면 willRemoveFunction 를 삭제하고 callbackKey 의 남은 스케줄 시간도 초기화 삭제 해야한다.
    let remove = false;

    const callbackKey = () => {
      // willRemoveFunction 함수 삭제
      remove = true;
    };

    const willRemoveFunction = (expectedTime: number) => {
      if (remove) {
        timeSchedule.removeScheduleContext(callbackKey);
        return null;
      }
      return expectedTime + 1_000;
    };

    // 1초 : willRemoveFunction 실행 -> 재등록
    // 2초 : callbackKey 첫번째 실행, remove = true 변경
    // 3초 : willRemoveFunction 실행 -> 스케줄에서 willRemoveFunction 삭제, callbackKey 전체 삭제

    timeSchedule.setScheduleContext(willRemoveFunction, Date.now() + 1_000);
    timeSchedule.setScheduleContext(callbackKey, [
      Date.now() + 2_000,
      Date.now() + 4_000, // 실행안되는 시간대
    ]);

    expect(timeSchedule.getRegister().time.length).toBe(3);
    expect(timeSchedule.getRegister().callback.size).toBe(2);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(timeSchedule.getRegister().time.length).toBe(0);
    expect(timeSchedule.getRegister().callback.size).toBe(0);
  });

  it('스케줄 콜백에서에서 스케줄 등록 테스트', async () => {

  });
});
