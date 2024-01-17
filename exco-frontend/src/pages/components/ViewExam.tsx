import React, { useState } from 'react';
import { Card, Typography, Button, Alert, Tag } from 'antd';
import ReactMarkdown from 'react-markdown';
import '../../Acid.css'

import { ExamDeliveryState } from '../../models/exam';
import { calcDuration, millisToHHMMSS } from '../../utils/common';
import { DownOutlined, UpOutlined } from '@ant-design/icons';

const { Text } = Typography;

function bigMessage(text: string): JSX.Element {
  return (
    <p style={{ textAlign: 'center', fontSize: '2.5em' }}>{text}</p>
  );
}


function ExamMsg(props: { state: ExamDeliveryState, hasScores: boolean }): JSX.Element {
  switch(props.state) {
    // case ExamDeliveryState.STD_EXAM_NOT_STARTED:
    //   return bigMessage('You\'ll get HH:MM:SS to complete if you start now');
    case ExamDeliveryState.STD_EXAM_SUBMITTED:
    case ExamDeliveryState.STD_EXAM_DONE_EXPIRED:
      return bigMessage('The exam has ended');
    case ExamDeliveryState.STD_EXAM_MISSED:
      return bigMessage('You\'ve missed the exam window');
    case ExamDeliveryState.STD_EXAM_EARLY:
      return bigMessage('The exam window has not started yet. Come back later');
    case ExamDeliveryState.STD_EXAM_NOT_FOUND:
      return bigMessage('The exam you\'re looking for does not exist');
    case ExamDeliveryState.GEN_EXAM_ERROR:
      return bigMessage('Something went wrong');
    default:
      return <></>;
  }
}

function NotStartedMsg(props: { examEnd: Date, duration: number, clampDuration: boolean, onExpire: () => void }): JSX.Element {
  const { examEnd, duration, clampDuration, onExpire } = props;

  const [timeStr, setTimeStr] = useState('HH:MM:SS');

  function setClock() {
    const actualDuration = calcDuration(examEnd, new Date(), duration, clampDuration);
    if(actualDuration <= 0) {
      onExpire();
      return;
    }
    setTimeStr(millisToHHMMSS(actualDuration));
  }

  React.useEffect(() => {
    const interval = setInterval(() => {
      setClock();
    }, 1000);
    setClock();
    return () => {
      clearInterval(interval);
      console.log('Cleared interval ' + interval + ' for NotStartedMsg');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return <p style={{ textAlign: 'center', fontSize: '2.5em' }}>You'll get {timeStr} to complete if you start now</p>;
}

function ScoreCard(props: { subTotal?: number, subGrand?: number, state: ExamDeliveryState, showScores: boolean }): JSX.Element {
  const stateOK = props.state === ExamDeliveryState.STD_EXAM_DONE_EXPIRED
               || props.state === ExamDeliveryState.STD_EXAM_SUBMITTED
               || props.state === ExamDeliveryState.TCH_EXAM_STDVIEW;
  const hasValues = props.subTotal !== undefined && props.subGrand !== undefined;
  const showScores = props.showScores;

  if(stateOK && showScores && hasValues) {
    return (
      <Tag color="cyan" style={{ fontSize: '16px', fontWeight: 'bold', float: 'right' }}>
        Score: {props.subTotal} / {props.subGrand}
      </Tag>
    );
  } else {
    return <></>;
  }
}

function TimeLeftCard(props: { startTime: Date, examEnd: Date, duration: number, clampDuration: boolean, onExpire: () => void }): JSX.Element {
  const { startTime, examEnd, duration, clampDuration, onExpire } = props;
  const actualDuration = calcDuration(examEnd, startTime, duration, clampDuration);
  const actualEnd = startTime.getTime() + actualDuration;

  console.log(props);

  const [timeStr, setTimeStr] = useState('HH:MM:SS');

  function setClock() {
    const durationLeft = actualEnd - Date.now();
    if(durationLeft <= 0) {
      onExpire();
      return;
    }
    const str = millisToHHMMSS(durationLeft);
    console.log(str);
    setTimeStr(str);
  }

  React.useEffect(() => {
    const interval = setInterval(() => {
      setClock();
    }, 1000);
    setClock();
    return () => {
      clearInterval(interval);
      console.log('Cleared interval ' + interval + ' for TimeLeftCard');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Tag color="cyan" style={{ fontSize: '16px', fontWeight: 'bold', float: 'right' }}>Time left: {timeStr}</Tag>;
}

const ViewExam: React.FC<{
  examID:      string;
  madeBy:      string;

  title:       string;
  description: string;
  windowStart: Date;
  windowEnd:   Date;
  duration:    number;
  clampTime:   boolean;
  showScores:  boolean;
  
  // submission part
  subID?:        string;
  subGivenBy?:   string;
  subStartTime?: Date;
  subFinished?:  boolean;
  subTotal?:     number;
  subGrand?:     number;

  state:        ExamDeliveryState;

  onOpenEdit?:    () => void;
  onEndExam?:     (setSpinner?: (loading: boolean) => void) => void;
  onStartExam?:   (setSpinner?: (loading: boolean) => void) => void;
  onMissed?:      () => void;
  onEndExamAuto?: () => void;

  limitedEdit?:    boolean;
}> = ({
  examID, madeBy,
  subID, subGivenBy, 
  title, description, windowStart, windowEnd, duration, clampTime, showScores,
  subStartTime, subTotal, subGrand, state,
  onOpenEdit, onEndExam, onStartExam, onMissed, onEndExamAuto,
  limitedEdit = false
}) => {

  function updateExpanded() {
    setExpanded(!expanded);
    localStorage.setItem('excard.exp', JSON.stringify(!expanded));
  }

  function getExpanded() {
    const exp = localStorage.getItem('excard.exp');
    if(exp) {
      return JSON.parse(exp);
    } else {
      localStorage.setItem('excard.exp', JSON.stringify(true));
      return true;
    }
  }

  const [expanded, setExpanded] = useState(getExpanded());

  const [ldState, setLdState] = useState(false);

  return (
    <Card bordered={false} style={{ width: '100%' }}>
      <Text style={{ fontSize: '25px', fontWeight: 'bold' }}>{title}</Text>

      <Button shape="circle" onClick={() => updateExpanded()} style={{ margin: '0px 10px', transform: 'translateY(-4px)', padding: '0px 5px' }}>
        {expanded ? <UpOutlined /> : <DownOutlined />}
      </Button>

      <ScoreCard subTotal={subTotal} subGrand={subGrand} state={state} showScores={showScores} />

      { state === ExamDeliveryState.STD_EXAM_STARTED
        && <TimeLeftCard
              startTime={subStartTime as Date}
              examEnd={windowEnd}
              duration={duration}
              clampDuration={clampTime}
              onExpire={onEndExamAuto ?? (() => {})}
              />
      }

      {
        expanded && (
          <div>
            { description ? <ReactMarkdown>{description}</ReactMarkdown> : <p></p> }
  
            <p><b>Window Start:</b> {windowStart.toLocaleString('en-GB')}</p>
            <p><b>Window End:</b> {windowEnd.toLocaleString('en-GB')}</p>
            <p><b>Duration:</b> {millisToHHMMSS(duration)}</p>
            { subStartTime && <p><b>Started:</b> {subStartTime.toLocaleString('en-GB')}</p> }
  
            { clampTime && <Alert message="The duration is restricted to window end" type="info" showIcon style={{ margin: '10px 0px' }} /> }

            { limitedEdit && <Alert message="This exam has scripts, editing have been limited" type="warning" showIcon style={{ margin: '10px 0px' }} /> }
  
            {
              state === ExamDeliveryState.STD_EXAM_NOT_STARTED
              ? <NotStartedMsg
                  examEnd={windowEnd}
                  duration={duration}
                  clampDuration={clampTime}
                  onExpire={onMissed ?? (() => {})}
                  />
              : <ExamMsg
                  state={state}
                  hasScores={showScores}
                  />
            }
          </div>
        )
      }


      <br />
      <br />
      <br />
      {
        (state === ExamDeliveryState.TCH_EXAM_EDIT && onOpenEdit !== undefined)
        && <Button onClick={onOpenEdit} style={{ float: 'right' }}>Edit</Button>
      }
      {
        (state === ExamDeliveryState.STD_EXAM_STARTED && onEndExam !== undefined)
        && <Button
              onClick={() => onEndExam(setLdState)}
              style={{ float: 'right' }}
              loading={ldState}
            >End Exam</Button>
      }
      {
        (state === ExamDeliveryState.STD_EXAM_NOT_STARTED && onStartExam !== undefined)
        && <Button
              onClick={() => onStartExam(setLdState)}
              style={{ float: 'right' }}
              loading={ldState}
            >Start Exam</Button>
      }
    </Card>
  );
};

export default ViewExam;