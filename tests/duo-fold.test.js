import { describe, expect, it } from 'vitest'
import { getDuoFoldPose, getTriFoldPose, roundedPanelPoints, projectDuoPoint } from '../src/utils/wallpaper/duoFold.js'

describe('Duo透视与磨砂材质', () => {
  it.each(['y', 'x'])('关闭时半屏居中，展开后归位，轴%s不挤压整张图', (axis) => {
    const width = 560, height = 400
    const closed = getDuoFoldPose(0, width, height, axis)
    const opened = getDuoFoldPose(1, width, height, axis)
    const length = axis === 'y' ? width : height
    expect(closed.shift).toBeCloseTo(-length / 4)
    expect(opened.shift).toBe(0)
    expect(closed.front).toBe(false)
    expect(opened.front).toBe(true)
    expect(opened.frost).toBeCloseTo(0)
    expect(projectDuoPoint(opened, 0, 0)).toEqual([0, 0])
    expect(projectDuoPoint(opened, opened.length / 2, opened.cross)).toEqual(axis === 'y' ? [width / 2, height] : [width, height / 2])
  })
  it('模糊峰值出现在半开时，起止均清晰而不是整个动画固定模糊', () => {
    const start = getDuoFoldPose(0, 600, 420, 'y')
    const middle = getDuoFoldPose(.5, 600, 420, 'y')
    const end = getDuoFoldPose(1, 600, 420, 'y')
    expect(start.frost).toBeCloseTo(0)
    expect(middle.frost).toBeCloseTo(1)
    expect(end.frost).toBeCloseTo(0)
    expect(middle.maxBlur).toBeGreaterThan(20)
    expect(middle.thickness).toBeGreaterThan(5)
  })
  it('圆角轮廓与透视结果始终有限，缩放和手机横向铰链均成立', () => {
    for (const axis of ['x', 'y']) {
      for (const progress of [0, .1, .25, .5, .75, .9, 1]) {
        const pose = getDuoFoldPose(progress, 300, 420, axis)
        const points = roundedPanelPoints(0, 0, pose.length / 2, pose.cross, 15, 3)
        expect(points.length).toBeGreaterThan(20)
        expect(points.flatMap(([a, b]) => projectDuoPoint(pose, a, b, -pose.thickness)).every(Number.isFinite)).toBe(true)
      }
    }
  })
})


describe('三折叠展开时序', () => {
  it('左扇先打开，右扇保留后盖后再打开，两扇最终归零', () => {
    expect(getTriFoldPose(0)).toEqual({ left: 180, right: -180, completion: 0 })
    const first = getTriFoldPose(.35)
    expect(first.left).toBeLessThan(90)
    expect(first.right).toBe(-180)
    const second = getTriFoldPose(.58)
    expect(second.left).toBe(0)
    expect(second.right).toBeLessThan(-90)
    expect(getTriFoldPose(1)).toMatchObject({ left: 0, right: -0 })
    expect(getTriFoldPose(1).completion).toBeCloseTo(1)
  })
  it('两扇的角度连续单向变化，完成层只在最后覆盖', () => {
    let previous = getTriFoldPose(0)
    for (let step = 1; step <= 100; step++) {
      const next = getTriFoldPose(step / 100)
      expect(next.left).toBeLessThanOrEqual(previous.left)
      expect(next.right).toBeGreaterThanOrEqual(previous.right)
      expect(previous.left - next.left).toBeLessThan(6)
      expect(next.right - previous.right).toBeLessThan(6)
      if (step <= 90) expect(next.completion).toBe(0)
      previous = next
    }
  })
})
