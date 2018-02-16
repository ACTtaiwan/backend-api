import * as fs from 'fs'
import * as _ from 'lodash'

export interface PaperTableItem {
  congress?: number
  billTypeDisplay?: string
  billNumber?: number
  version?: string
  category?: string
  tags?: string[]
  comment?: string
}

export class DropboxPaperData {
  public static getData (fname: string): PaperTableItem[] {
    let json = fs.readFileSync(fname).toString()
    return JSON.parse(json)
  }
}

let parseLine = (line: string): string[] => {
  let arr = line.split('|').map(x => x.trim()).map(x => (x.match(/(\*\*|__)(.*?)\1/) || [])[2] || x).slice(1)
  arr.pop()
  return arr
}

let convert = (fname: string): PaperTableItem[] => {
  const lines: string[] = fs.readFileSync(fname).toString().split('\n')
  const header: string[] = parseLine(lines.shift())
  const out: PaperTableItem[] = []
  _.each(lines, line => {
    const obj = <PaperTableItem> {}
    _.zipWith(header, parseLine(line)).forEach(([k, v]) => {
      if (k && v && k !== '#') {
        switch (k) {
          case 'congress':
            obj.congress = parseInt(v)
            break

          case 'bill code':
            obj.billNumber = parseInt( (v.match(/[0-9].*/) || [])[0])
            obj.billTypeDisplay = v.replace(obj.billNumber.toString(), '').trim()
            break

          case 'tags':
            obj.tags = v.split(',').map(x => x.trim()).filter(x => x)
            break

          default:
            obj[k] = v
        }
      }
    })
    if (obj.congress && obj.billTypeDisplay && obj.billNumber) {
      out.push(obj)
    }
  })
  return out
}

let convertAll = (): PaperTableItem[] => {
  const items = fs.readdirSync('./').filter(x => x.endsWith('.md'))
  let out = []
  _.each(items, item => out = out.concat(convert(item)))
  return out
}

const out = convertAll()
console.log(JSON.stringify(out, null, 2))
