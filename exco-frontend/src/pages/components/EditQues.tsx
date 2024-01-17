import React, { useState } from 'react';
import { Card, Input, InputNumber, Row, Col, Typography, Checkbox, Button, Radio, Space } from 'antd';
import ReactMarkdown from 'react-markdown';
import '../../Acid.css';

import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import remarkGfm from 'remark-gfm';
import { DeleteOutlined } from '@ant-design/icons';
import { QDataDynamic, QuesType } from '../../models/exam';

const { Title } = Typography;

type ChoiceOpt = { text: string; };

const OptGeneral: React.FC<{
  index: number,
  onRemove: () => void,
  text: string,
  textChange: (txt: string) => void,
  isCBox: boolean,
  noRemove: boolean,
}> = ({ index, onRemove, text, textChange, isCBox, noRemove }) => {

  const inside = (
    <>
      <Input placeholder="Option Text" bordered={false} style={{ width: 'calc(100% - 40px)' }} value={text} onChange={e => textChange(e.target.value)} />
      <Button
        type="link"
        style={{ width: '40px', height: '30px' }}
        onClick={() => onRemove()}
        disabled={noRemove}
        >
        <DeleteOutlined style={{ fontSize: '20px', color: '#c4161b' }} />
      </Button>
    </>
  );

  return (
    <Card size="small">
      {
        isCBox ? (
          <Checkbox style={{ width: '100%' }} className="full-check-2nd-child optcont" value={index}>
            {inside}
          </Checkbox>
        ) : (
          <Radio style={{ width: '100%' }} className="full-check-2nd-child optcont" value={index}>
            {inside}
          </Radio>
        )
      }
    </Card>
  );
};

const EditQues: React.FC<{
  index:       number,
  quesID:      string | null,
  text:        string,
  points:      number,
  maxAttempts: number,
  quesType:    QuesType,
  options:     string[],

  // state:       ExamDeliveryState,
  // hasScores:   boolean,
  correct:     number[],

  // usedAttempts?: number,
  // provided?:     number[],

  // subAchieved?:  number,

  // onSubmit?: () => void,
  // onEdit?:   () => void,
  onEditClose: () => void,
  onEditSave: (quesData: QDataDynamic, setSpinner?: (loading: boolean) => void) => void,

  limitedEdit?:    boolean;
}> = ({
  index, quesID,
  text, points, maxAttempts, quesType, options, correct,
  onEditClose, onEditSave,
  limitedEdit = false
}) => {
  const [desc, setDesc] = useState(text);
  const [opts, setOpts]                = useState<ChoiceOpt[]>(options.map(text => ({ text })));
  const [selected, setSelected]        = useState<number[]>(correct);
  const [isCheck, setIsCheck]          = useState(quesType === QuesType.CHECKBOX);
  const [_points, setPoints]           = useState(points);
  const [_maxAttempts, setMaxAttempts] = useState(maxAttempts === -1 ? 1 : maxAttempts);
  
  const [unlimited, setUnlimited] = useState(maxAttempts === -1);

  const [dlevel, setDlevel] = useState("b");
  const [ldstate, setLdstate] = useState(false);

  function setSels(sels: number[]) {
    if (isCheck) {
      setSelected(sels);
    } else {
      setSelected(sels.slice(0, 1));
    }
  }

  function textChange(index: number, text: string) {
    setOpts(opts.map((opt, i) => i === index ? { text } : opt));
  }

  function addOpt() {
    setOpts([...opts, { text: '' }]);
  }

  function removeOpt(index: number) {
    const sels: number[] = selected;
    const newSels = sels.filter(s => s !== index).map(s => s > index ? s - 1 : s);
    setSels(newSels);
    setOpts(opts.filter((_, i) => i !== index));
  }

  function changeMode(newIsCheck: boolean) {
    // if going to radio, remove all but first
    if (isCheck && !newIsCheck && selected.length > 1) {
      setSels([selected[0]]);
    }
    setIsCheck(newIsCheck);
  }

  function cancelEditing() {
    onEditClose();
  }

  return (
    <Card bordered={false} style={{ width: '100%', margin: '10px 0px' }}>
      <Row>
        <Title level={4}>Question Text</Title>
        <Radio.Group onChange={(e) => setDlevel(e.target.value)} value={dlevel} style={{ marginTop: '29px', marginLeft: '10px' }} size="small">
          <Radio.Button value="b">Show Both</Radio.Button>
          <Radio.Button value="m">Show Markdown Only</Radio.Button>
          <Radio.Button value="p">Show Preview Only</Radio.Button>
        </Radio.Group>
      </Row>
      {
        (desc.length > 0) && (dlevel === "b" || dlevel === "p")
          ? <ReactMarkdown children={desc} remarkPlugins={[remarkGfm]} />
          : <p></p>
      }
      {
        (dlevel === "b" || dlevel === "m") && (
        <CodeMirror
          value={desc}
          placeholder="Question Text (Markdown) - The rendered version will appear above"
          extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
          onChange={(value, viewUpdate) => {
            setDesc(value)
          }}
          style={{ margin: '20px 14px' }}
        />
        )
      }
      <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }} style={{ margin: '10px 0' }}>
        <Col span={8}>
          <InputNumber addonBefore="Points" defaultValue={1} min={1} style={{ width: '98%' }} value={_points} onChange={val => setPoints(val || 1)} />
        </Col>
        <Col span={8}>
          <InputNumber addonBefore="Max Attempts" defaultValue={1} min={1} style={{ width: '98%' }} disabled={unlimited} value={_maxAttempts} onChange={val => setMaxAttempts(val || 1)} />
        </Col>
        <Col span={8}>
          <Checkbox onChange={e => setUnlimited(e.target.checked)} checked={unlimited} style={{ marginTop: '5px' }}>Unlimited Attempts</Checkbox>
        </Col>
      </Row>
      <Row>
        <Radio.Group onChange={e => changeMode(e.target.value)} value={isCheck} style={{ marginTop: '29px', marginLeft: '10px' }} size="small">
          <Radio.Button value={true}>Multiple Choice</Radio.Button>
          <Radio.Button value={false}>Single Choice</Radio.Button>
        </Radio.Group>
      </Row>
      {
        isCheck ? (
          <Checkbox.Group style={{ width: '100%' }} value={selected} onChange={sels => setSels(sels as number[])}>
            <Space direction="vertical" size="middle" style={{ display: 'flex', margin: '20px 14px', width: '100%' }}>
              {
                opts.map((opt, i) => (
                  <OptGeneral
                    index={i}
                    key={i}
                    onRemove={() => removeOpt(i)}
                    text={opt.text}
                    textChange={(txt) => textChange(i, txt)}
                    isCBox={true}
                    noRemove={limitedEdit}
                  />
                ))
              }
              <Button type="dashed" style={{ height: '48px' }} onClick={addOpt} block disabled={limitedEdit}>Add An{opts.length > 0 ? 'other': ''} Option</Button>
            </Space>
          </Checkbox.Group>
        ) : (
          <Radio.Group style={{ width: '100%' }} value={selected[0]} onChange={sels => setSels([sels.target.value as number])}>
            <Space direction="vertical" size="middle" style={{ display: 'flex', margin: '20px 14px' }}>
              {
                opts.map((opt, i) => (
                  <OptGeneral
                    index={i}
                    key={i}
                    onRemove={() => removeOpt(i)}
                    text={opt.text}
                    textChange={(txt) => textChange(i, txt)}
                    isCBox={false}
                    noRemove={limitedEdit}
                  />
                ))
              }
              <Button type="dashed" style={{ height: '48px' }} onClick={addOpt} block disabled={limitedEdit}>Add An{opts.length > 0 ? 'other': ''} Option</Button>
            </Space>
          </Radio.Group>
        )
      }
      <Button type="primary" onClick={() => {
        onEditSave({
          text:        desc,
          points:      _points,
          maxAttempts: unlimited ? -1 : _maxAttempts,
          quesType:    isCheck ? QuesType.CHECKBOX : QuesType.RADIO,
          options:     opts.map(opt => opt.text),
          correct:     selected
        }, setLdstate);
      }} style={{ float: 'right', marginRight: '14px' }} loading={ldstate}>Save</Button>
      <Button type="primary" onClick={cancelEditing} style={{ float: 'right', marginRight: '14px' }}>Cancel</Button>
    </Card>
  );
};
  
export default EditQues;