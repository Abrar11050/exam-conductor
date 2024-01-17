import React, { useState } from 'react';
import { Card, Input, InputNumber, DatePicker, Row, Col, Typography, Checkbox, Button, Radio } from 'antd';
import ReactMarkdown from 'react-markdown';
import '../../Acid.css';

import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import remarkGfm from 'remark-gfm';

import dayjs from 'dayjs';
import { EDataDynamic } from '../../models/exam';

const { RangePicker } = DatePicker;
const { Title } = Typography;

const EditExam: React.FC<{
  examID:      string;
  madeBy:      string;
  title:       string;
  description: string;
  windowStart: Date;
  windowEnd:   Date;
  duration:    number; // milliseconds
  clampTime:   boolean;
  showScores:  boolean;

  onSave: (newData: EDataDynamic, setSpinner?: (loading: boolean) => void) => void;
  onDelete: (setSpinner?: (loading: boolean) => void) => void;
}> = ({
  examID, madeBy,
  title, description, windowStart, windowEnd, duration, clampTime, showScores,
  onSave, onDelete
}) => {
  const [theTitle, setTheTitle] = useState(title);
  const [desc, setDesc]         = useState(description);
  const [hours, setHours]       = useState(Math.floor(duration / 3600000));
  const [minutes, setMinutes]   = useState(Math.floor((duration % 3600000) / 60000));
  const [clamp, setClamp]       = useState(clampTime);
  const [scores, setScores]     = useState(showScores);
  const [winRange, setWinRange] = useState<{ start: Date, end: Date }>({ start: windowStart, end: windowEnd });


  // auxillary states
  const [loaderUpdate, setLoaderUpdate] = useState(false);
  const [loaderDelete, setLoaderDelete] = useState(false);
  const [dlevel, setDlevel] = useState("b");

  return (
    <Card bordered={false} style={{ width: '100%' }}>
      <Title level={4}>Exam Title</Title>
      <Input placeholder="Exam Title" value={theTitle} onChange={e => setTheTitle(e.target.value)} />
      <Row>
        <Title level={4}>Exam Description</Title>
        <Radio.Group onChange={e => setDlevel(e.target.value)} value={dlevel} style={{ marginTop: '29px', marginLeft: '10px' }} size="small">
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
          placeholder="Exam Description (Markdown) - The rendered version will appear above"
          extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
          onChange={(value, _) => setDesc(value)}
        />
        )
      }
      <Row>
        <Col span={12}>
          <Title level={4}>Exam Window</Title>
          <RangePicker
            showTime
            style={{ width: '95%' }}
            defaultValue={[dayjs(windowStart), dayjs(windowEnd)]}
            onChange={(dates, _) => {
              if (dates && dates.length === 2) {
                setWinRange({
                  start: dates[0]?.toDate() || winRange.start,
                  end:   dates[1]?.toDate() || winRange.end
                });
              }
            }}
          />
        </Col>
        <Col span={12}>
          <Title level={4}>Exam Duration</Title>
          <Input.Group compact style={{ width: '100%' }}>
            <InputNumber addonBefore="Hours" defaultValue={1} min={0} max={100} style={{ width: '50%' }} value={hours} onChange={value => setHours(value || 0)} />
            <InputNumber addonBefore="Minutes" defaultValue={0} min={0} max={59} style={{ width: '50%' }} value={minutes} onChange={value => setMinutes(value || 0)} />
          </Input.Group>
        </Col>
      </Row>
      <Row style={{ margin: '10px 0' }}>
        <Checkbox checked={clamp} onChange={e => setClamp(e.target.checked)}>Clamp duration to the end of window</Checkbox>
      </Row>
      <Row>
        <Checkbox checked={scores} onChange={e => setScores(e.target.checked)}>Reveal answers</Checkbox>
      </Row>
      <Button type="primary" style={{ marginTop: '10px', float: 'right' }} loading={loaderUpdate}
        onClick={() => {
          onSave({
            title:       theTitle,
            description: desc,
            windowStart: winRange.start,
            windowEnd:   winRange.end,
            duration:    (hours * 3600000) + (minutes * 60000),
            clampTime:   clamp,
            showScores:  scores
          }, setLoaderUpdate);
        }}
        >Save</Button>
      <Button type="primary" danger style={{ marginTop: '10px', float: 'right', marginRight: '10px' }} loading={loaderDelete}
        onClick={() => {
          onDelete(setLoaderDelete);
        }}
        >Delete</Button>
    </Card>
  );
};
  
export default EditExam;