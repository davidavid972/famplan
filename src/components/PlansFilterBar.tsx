import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useFamily } from '../context/FamilyProvider';
import { ChevronDown, Users } from 'lucide-react';
import type { Person } from '../types/models';

interface PlansFilterBarProps {
  people: Person[];
}

export const PlansFilterBar: React.FC<PlansFilterBarProps> = ({ people }) => {
  const { t, dir } = useI18n();
  const { planFilterPersonIds, setPlanFilterPersonIds, selectionColor } = useFamily();
  const [expanded, setExpanded] = useState(false);

  const isAll = !planFilterPersonIds || planFilterPersonIds.length === 0;
  const selectedSet = new Set(planFilterPersonIds ?? []);

  const handleAll = () => {
    setPlanFilterPersonIds(null);
    setExpanded(false);
  };

  const handleTogglePerson = (personId: string) => {
    const next = selectedSet.has(personId)
      ? (planFilterPersonIds ?? []).filter((id) => id !== personId)
      : [...(planFilterPersonIds ?? []), personId];
    setPlanFilterPersonIds(next.length === 0 ? null : next);
  };

  const handleSelectAll = () => {
    if (people.length === 0) return;
    const allIds = people.map((p) => p.id);
    setPlanFilterPersonIds(allIds);
  };

  if (people.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={handleAll}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            isAll ? 'text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
          style={{ backgroundColor: isAll ? selectionColor : undefined }}
        >
          {t('all')}
        </button>
        <button
          onClick={() => setExpanded((e) => !e)}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            expanded ? 'text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
          style={{ backgroundColor: expanded ? selectionColor : undefined }}
        >
          <Users className="w-4 h-4" />
          {t('plans_filter_by_people')}
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div
          className={`flex flex-col gap-2 p-4 bg-white rounded-2xl border border-stone-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
        >
          <button
            onClick={handleSelectAll}
            className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors py-1"
          >
            {t('select_all')}
          </button>
          <div className="flex flex-col gap-2">
            {people.map((person) => {
              const checked = selectedSet.has(person.id);
              return (
                <label
                  key={person.id}
                  className="flex items-center gap-3 cursor-pointer min-h-[44px] py-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleTogglePerson(person.id)}
                    className="w-5 h-5 rounded border-stone-300 text-stone-600 focus:ring-2 focus:ring-offset-0 cursor-pointer"
                    style={{ accentColor: selectionColor }}
                  />
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: person.color }}
                  />
                  <span className="text-stone-900 font-medium">{person.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
