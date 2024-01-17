import React, { useState } from 'react';
import { Card, Typography, Checkbox, Button, Radio, Space, Tag } from 'antd';
import ReactMarkdown from 'react-markdown';
import '../../Acid.css';

import remarkGfm from 'remark-gfm';
import { ExamDeliveryState, QuesType } from '../../models/exam';

const { Title } = Typography;

const OptGeneral: React.FC<{
  index:    number,
  text:     string,
  isCBox:   boolean,
  isGreen?: boolean,
}> = ({ index, text, isCBox, isGreen }) => {

  const SelType = isCBox ? Checkbox : Radio;
  let empStyle: React.CSSProperties | undefined = undefined;

  if(isGreen) {
    empStyle = { border: '2px solid #008f0c' };
  }

  return (
    <Card size="small" style={empStyle}>
      <SelType style={{ width: '100%' }} className="full-check-2nd-child optcont" value={index}>{text}</SelType>
    </Card>
  );
};

function OviewTag(props: { state: ExamDeliveryState, hasScores: boolean, points: number, subAchieved?: number, usedAttempts?: number }): JSX.Element {
  if(
    (props.state === ExamDeliveryState.TCH_EXAM_STDVIEW) ||
    (props.hasScores && (props.state === ExamDeliveryState.STD_EXAM_DONE_EXPIRED || props.state === ExamDeliveryState.STD_EXAM_SUBMITTED))
  ) {

    if(props.subAchieved === undefined || props.usedAttempts === undefined) {
      return <></>;
    }
  
    let color = 'green';
    let text = 'Correct';
  
    if(props.usedAttempts === 0) {
      color = 'gray';
      text = 'Not Attempted';
    }
  
    if(props.subAchieved === 0) {
      color = 'red';
      text = 'Incorrect';
    } else if(props.subAchieved < props.points) {
      color = 'orange';
      text = 'Partially Correct';
    }
  
    return <Tag color={color} style={{ float: 'right', fontWeight: 'bold' }}>{text}</Tag>;
  } else {
    return <></>;
  }
}

function PointAttempt(props: { state: ExamDeliveryState, maxAttempts: number, points: number, hasScores: boolean, subAchieved?: number, usedAttempts?: number }): JSX.Element {
  const { state, maxAttempts, subAchieved, usedAttempts, hasScores, points } = props;
  if(state === ExamDeliveryState.TCH_EXAM_EDIT) {
    return (
      <>
        <Tag>Attempts: {maxAttempts === -1 ? '∞' : maxAttempts}</Tag>
        <Tag>Points: {points}</Tag>
      </>
    );
  } else if(hasScores || state === ExamDeliveryState.TCH_EXAM_STDVIEW) {
    return (
      <>
        <Tag>Attempts: {usedAttempts} / {maxAttempts === -1 ? '∞' : maxAttempts}</Tag>
        <Tag>Points: {subAchieved} / {points}</Tag>
      </>
    );
  } else if(state === ExamDeliveryState.STD_EXAM_STARTED) {
    return (
      <>
        <Tag>Attempts Used: {usedAttempts} / {maxAttempts === -1 ? '∞' : maxAttempts}</Tag>
      </>
    );
  } else {
    return <></>;
  }
}

type OptCheckable = {
  options: { text: string, isGreen: boolean }[],
  checked: number[]
};

function getCheckables(state: ExamDeliveryState, hasScores: boolean, options: string[], correct?: number[], provided?: number[]): OptCheckable {
  const ret: OptCheckable = { options: [], checked: [] };

  if(state === ExamDeliveryState.TCH_EXAM_EDIT) {
    ret.options = options.map(opt => ({ text: opt, isGreen: false }));
    ret.checked = correct ?? [];
  } else if(
    (state === ExamDeliveryState.TCH_EXAM_STDVIEW) ||
    (state === ExamDeliveryState.STD_EXAM_STARTED) ||
    (hasScores && (state === ExamDeliveryState.STD_EXAM_DONE_EXPIRED || state === ExamDeliveryState.STD_EXAM_SUBMITTED))
  ) {
    ret.options = options.map(opt => ({ text: opt, isGreen: false }));

    if(correct && state !== ExamDeliveryState.STD_EXAM_STARTED) {
      for(const i of correct) {
        if(i < ret.options.length && i >= 0) {
          ret.options[i].isGreen = true;
        }
      }
    }

    ret.checked = provided ?? [];
  }

  return ret;
}

function canAttempt(checked: number[], usedAttempts: number, maxAttempts: number): boolean {
  if(checked.length > 0) {
    if(maxAttempts === -1) {
      return true;
    } else {
      return usedAttempts < maxAttempts;
    }
  } else {
    return false;
  }
}

const ViewQues: React.FC<{
    index:       number,
    text:        string,
    points:      number,
    maxAttempts: number,
    quesType:    QuesType,
    options:     string[],

    state:       ExamDeliveryState,
    hasScores:   boolean,
    correct?:      number[],

    usedAttempts?: number,
    provided?:     number[],

    subAchieved?:  number,

    canEdit:       boolean,

    onGotoEdit?:    () => void,
    onDelete?:      (setSpinner?: (loading: boolean) => void) => void,
    onQuesAttempt?: (provided: number[], incTrialCount: () => void, setSpinner?: (loading: boolean) => void) => void,

    limitedEdit?: boolean
}> = ({
    index, text, points, maxAttempts, quesType, options,
    state, hasScores,
    usedAttempts: spentTrials, correct, provided,
    subAchieved,
    canEdit,
    onGotoEdit, onDelete, onQuesAttempt,
    limitedEdit = false
}) => {
  const isCheck = quesType === QuesType.CHECKBOX;

  const [ldstate, setLdstate] = useState(false);

  function setSels(sels: number[]) {
    if (isCheck) {
      setSelected(sels);
    } else {
      setSelected(sels.slice(0, 1));
    }
  }

  const checkables = getCheckables(state, hasScores, options, correct, provided);
  const mapped = checkables.options.map((opt, i) => (
    <OptGeneral
      index={i}
      key={i}
      text={opt.text}
      isCBox={isCheck}
      isGreen={opt.isGreen}
    />
  ));

  const disabled = state === ExamDeliveryState.STD_EXAM_DONE_EXPIRED
                || state === ExamDeliveryState.STD_EXAM_SUBMITTED
                || state === ExamDeliveryState.TCH_EXAM_STDVIEW
                || state === ExamDeliveryState.TCH_EXAM_EDIT;

  const [selected, setSelected] = useState<number[]>(checkables.checked ?? []);
  const [usedAttempts, setUsedAttempts] = useState<number>(spentTrials ?? 0);

  const [subDone, setSubDone] = useState<boolean>(false);

  function markSubDone() {
    setSubDone(true);
    setTimeout(() => setSubDone(false), 1000);
  }

  return (
    <Card bordered={false} style={{ width: '100%', margin: '10px 0px' }}>
      <Title level={5} style={{ fontWeight: 'bold', color: 'gray' }}>Question {index + 1}</Title>
      <OviewTag state={state} hasScores={hasScores} points={points} subAchieved={subAchieved}
        usedAttempts={usedAttempts}
      />
      {
        (text.length > 0) ? <ReactMarkdown children={text} remarkPlugins={[remarkGfm]} /> : <p></p>
      }
      <PointAttempt state={state} maxAttempts={maxAttempts} points={points}
        hasScores={hasScores} subAchieved={subAchieved} usedAttempts={usedAttempts}
      />
      {
        isCheck ? (
          <Checkbox.Group style={{ width: '100%' }} value={selected} onChange={disabled ? undefined : (sels => setSels(sels as number[]))}>
            <Space direction="vertical" size="middle" style={{ display: 'flex', margin: '20px 14px', width: '100%' }}>
              {mapped}
            </Space>
          </Checkbox.Group>
        ) : (
          <Radio.Group style={{ width: '100%' }} value={selected[0]} onChange={disabled ? undefined : (sels => setSels([sels.target.value as number]))}>
            <Space direction="vertical" size="middle" style={{ display: 'flex', margin: '20px 14px' }}>
              {mapped}
            </Space>
          </Radio.Group>
        )
      }
      {
        (state === ExamDeliveryState.STD_EXAM_STARTED) && (
          <Button
            type="primary"
            onClick={() => {
              setSubDone(false);
              onQuesAttempt?.(
                selected,
                () => {
                  setUsedAttempts(usedAttempts + 1);
                  markSubDone();
                },
                setLdstate
              )
            }}
            style={{ float: 'right', marginRight: '14px', ...(subDone ? { backgroundColor: '#32a852' } : {}) }}
            loading={ldstate}
            disabled={!canAttempt(selected, usedAttempts as number, maxAttempts)}
            >{subDone ? 'Submitted!' : 'Submit'}</Button>
        )
      }
      {
        (state === ExamDeliveryState.TCH_EXAM_EDIT) && (
          <>
            <Button
              type="primary"
              disabled={!canEdit}
              onClick={() => onGotoEdit?.()}
              style={{ float: 'right', marginRight: '14px' }}
              >Edit</Button>
            <Button
              type="primary"
              danger
              loading={ldstate}
              disabled={!canEdit || limitedEdit}
              onClick={() => onDelete?.(setLdstate)}
              style={{ float: 'right', marginRight: '14px' }}
              >Delete</Button>
          </>
        )
      }
    </Card>
  );
};
  
export default ViewQues;