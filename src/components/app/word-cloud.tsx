import ReactWordcloud from 'react-wordcloud'
import { cn } from '../../lib/utils'

type CloudWord = {
  word: string
  count: number
}

type WordCloudProps = {
  words: CloudWord[]
  blankWhenEmpty?: boolean
  className?: string
  minSize?: [number, number]
}

export function WordCloud({
  words,
  blankWhenEmpty = false,
  className,
  minSize = [320, 320],
}: WordCloudProps) {
  const cloudWords = words.slice(0, 80).map((item) => ({
    text: item.word,
    value: item.count,
  }))

  const options = {
    deterministic: true,
    enableTooltip: false,
    fontFamily: 'Rubik, sans-serif',
    fontSizes: [18, 82] as [number, number],
    fontStyle: 'normal',
    fontWeight: '700',
    padding: 2,
    randomSeed: 'pulsewords',
    rotationAngles: [-90, 0] as [number, number],
    rotations: 2,
    scale: 'sqrt' as const,
    transitionDuration: 400,
  }

  return (
    <div
      className={cn(
        'relative mt-3 min-h-72 overflow-hidden rounded-2xl border border-zinc-700 bg-[repeating-linear-gradient(-30deg,#31353b,#31353b_12px,#2c3035_12px,#2c3035_24px)]',
        blankWhenEmpty && 'mt-0 border-0 bg-transparent',
        className,
      )}
    >
      {cloudWords.length ? (
        <ReactWordcloud words={cloudWords} options={options} maxWords={80} minSize={minSize} />
      ) : blankWhenEmpty ? null : (
        <div className="grid min-h-72 place-content-center text-zinc-400">
          <span>Waiting for words</span>
        </div>
      )}
    </div>
  )
}
