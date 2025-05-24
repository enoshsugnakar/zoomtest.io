'use client';

import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';

interface Question {
  id: string;
  question_text: string;
  type: 'multiple_choice' | 'text_answer'; // Updated enum value
  options?: string[];
  correct_answer?: string;
  order: number;
}

interface QuestionItemsProps {
  question: Question;
  index: number;
  onUpdate: (id: string, field: string, value: any) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
}

export default function QuestionItems({ question, index, onUpdate, onMove }: QuestionItemsProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'question',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'question',
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`p-4 bg-gray-50 rounded-lg border ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <span className="text-gray-500 cursor-move">⋮⋮</span>
          <select
            value={question.type}
            onChange={(e) => onUpdate(question.id, 'type', e.target.value)}
            className="border rounded p-2"
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="text_answer">Text Answer</option>
          </select>
        </div>
        <span className="text-sm text-gray-500">Question {index + 1}</span>
      </div>

      <div className="space-y-4">
        <textarea
          value={question.question_text}
          onChange={(e) => onUpdate(question.id, 'question_text', e.target.value)}
          className="w-full border rounded p-2"
          placeholder="Enter your question"
          rows={3}
        />

        {question.type === 'multiple_choice' && (
          <div className="space-y-2">
            {question.options?.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={`correct_${question.id}`}
                  checked={question.correct_answer === option}
                  onChange={() => onUpdate(question.id, 'correct_answer', option)}
                  className="mt-1"
                />
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(question.options || [])];
                    newOptions[optionIndex] = e.target.value;
                    onUpdate(question.id, 'options', newOptions);
                  }}
                  className="flex-1 border rounded p-2"
                  placeholder={`Option ${optionIndex + 1}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}