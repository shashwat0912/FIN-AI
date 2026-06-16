import { BrainCircuit } from 'lucide-react';
import { getCategoryStyle, animations } from '../../styles/tokens';

interface AiSuggestionProps {
  type: 'savings' | 'investment' | 'insurance' | 'budget';
  title: string;
  description: string;
}

export default function AiSuggestion({ type, title, description }: AiSuggestionProps) {
  const categoryStyle = getCategoryStyle(type);
  
  return (
    <div className={`p-4 rounded-lg border shadow-sm hover:shadow-md ${animations.transition.normal} 
                    bg-gradient-to-br ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border} ${animations.hover.scale}`}>
      <div className="flex items-start">
        <div className={`p-2 rounded-lg ${categoryStyle.icon}`}>
          <BrainCircuit className="w-4 h-4" />
        </div>
        <div className="ml-3">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm mt-1 opacity-90">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}