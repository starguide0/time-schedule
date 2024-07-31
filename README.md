## 타임 스케줄
### 개요
setTimeout/clearTimeout 혹은 setInterval/clearInterval 에 설정된 duration 시간은
로직상 동적으로 시간이 변경이 되지않기 때문에 clear 를 해주고 재 설정을 해야한다. 제한 된 device 의 브라우저에서 해당 동작을 자주 발생시키면 GC 동작을 자주 발생하는 현상을 보였다.
web api 리소스를 줄이기 위해서 로직상으로 시간을 관리하는 방안을 고안하였다.

### 고려사항
- 단일 함수를 키로 사용하여 시간을 변경 하는 기능
- setTimeout, setInterval 를 기능 통합
- 여러 스케줄러를 생성
- 시간 표현 방법이 다양하므로 다양한 시간 설정기능
  - string: iso8601 표준 표기, 예) '2020-12-12 12:30:10'
  - number: unix time 기준으로 설정된 숫자
  - Date 객체: javascript Data 객체

### 사용
`생성/시작/등록/해제/종료` 의 컨셉으로 사용한다.
타임 스케줄은 setTimeout 와 유사하게 callback 함수와, 실행 될 시간을 입력하는데 중요한 부분은
`시간은 반드시 절대시간`을 사용한다. callback 함수를 키값으로 사용하여 `등록/해제` 를 한다.
- 생성:
    ```javascript
    const schedule = new TimeSchedule(1_000); // 스케줄 체크 interval 시간 설정 
    ```
- 시작:
    ```javascript
    schedule.startSchedule();
    ```
- 등록
    ```javascript
    schedule.pushScheduleContext(
        callback,
        Date.now(),
        '2020-12-12 12:30:40');
    schedule.updateScheduleContext(
        callback,
        Date.now(),
        '2020-12-12 12:30:40');
    ```
  - pushScheduleContext : 추가
    - 연속으로 사용될 경우 같은 callback 인자값에 정해져있는 이벤트 발생 일자가 추가된다.
  - updateScheduleContext :
    - 기존에 등록된 callback 과 이벤트 발생 일자를 삭제하고 등록
    - callback 등록되어 있지 않으면 추가.
- 해제
    ```javascript
    schedule.removeScheduleContext(callback);
    ```
- 종료
    ```javascript
    schedule.endSchedule();
    ```

### 실험
WebAPI(setTimeout, setInterval) 사용했을 때와 타임스케줄 사용했을 때 메모리처리에 대한 실험결과
https://torderjira.atlassian.net/wiki/spaces/T1PM/pages/232652858/setTimeout+clearTimeout+setInterval+clearTimeout
