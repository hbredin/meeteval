let colormaps = {
    default: {
        'correct': 'lightgray',
        'substitution': '#F5B14D',  // yellow / orange
        'insertion': '#3F6193', // blue
        'deletion': '#B3381A',  // red
    },
    diff: {
        'correct': 'lightgray',
        'substitution': 'yellow',
        'insertion': 'green',
        'deletion': 'red',
    },
    seaborn_muted: {
        'correct': 'lightgray',
        'substitution': '#dd8452',  // yellow
        'insertion': '#4c72b0', // blue
        'deletion': '#c44e52',  // red
    }
}

function alignment_visualization(
    data,
    element_id = '#my_dataviz',
    settings= {
        colors: colormaps.default,
        barplot: {
            style: 'absolute', // hidden, absolute, relative
            scaleExcludeCorrect: false
        },
        minimaps: {
            number: 2,
            height: 200,
        }
    }
) {

    // Validate settings
    for (const label of ['correct', 'substitution', 'insertion', 'deletion']) {
        if (settings.colors[label] === undefined) throw `Missing key in "colors" setting: ${label}`;
    }

    /**
 * Draw a single axis, as defined by a d3 scale, on a canvas using its 2d context
 *
 * @param context The canvas' 2d context
 * @param scale The d3 scale that defines the axis / space
 * @param position The position of the axis from the bottom (horizontal) or left (vertical) of the canvas
 * @param padding The starting point of the axis line (padding of the other axis) from the left (horizontal) or bottom (vertical) of the canvas
 * @param horizontal Whether the axis is horizontal or vertical
 * @param tickPadding The padding between the tick marks and the tick labels
 * @param tickSize The size/length of the tick marks
 */
function drawAxis(
    context,
    scale,
    position,
    padding,
    horizontal,
    tickPadding = 3,
    tickSize = 6,
) {
    const [start, end] = scale.range(),
        tickFormat = scale.tickFormat ? scale.tickFormat() : d => d,
        ticks = (scale.ticks ? scale.ticks() : scale.domain()).map(d => {
            return {
                pos: scale(d) + (scale.bandwidth ? scale.bandwidth() / 2 : 0),
                label: tickFormat(d)
            }
        });

    // Flip coords if vertical
    let coord, c;
    if (horizontal) {
        coord = (x, y) => [x, position + y]
        c = (x, y) => [x, y]
    } else {
        coord = (x, y) => [position - y, x]
        c = (x, y) => [-y, x]
    }

    // Set up context
    context.lineWidth = 1;
    context.strokeStyle = "black";  // Line color
    context.fillStyle = "black";    // Font color

    // Clear the axis part of the plot
    context.clearRect(...coord(start, 0), ...c(end - start, padding));

    // Tick marks
    context.beginPath();
    ticks.forEach(d => {
        context.moveTo(...coord(d.pos, 0));
        context.lineTo(...coord(d.pos, tickSize));
    });
    // Line
    context.moveTo(...coord(start, tickSize));
    context.lineTo(...coord(start, 0));
    context.lineTo(...coord(end, 0));
    context.lineTo(...coord(end, tickSize));
    context.stroke();

    // Tick labels
    if (horizontal) {
        context.textAlign = "center";
        context.textBaseline = "top";
    } else {
        context.textAlign = "right";
        context.textBaseline = "middle";
    }

    ticks.forEach(d => {
        context.fillText(d.label, ...coord(d.pos, tickSize + tickPadding));
    });
}

  /**
 * Draw a single axis, as defined by a d3 scale, on a canvas using its 2d context
 *
 * @param context The canvas' 2d context
 * @param scale The d3 scale that defines the axis / space
 * @param position The position of the axis from the bottom (horizontal) or left (vertical) of the canvas
 * @param padding The starting point of the axis line (padding of the other axis) from the left (horizontal) or bottom (vertical) of the canvas
 * @param horizontal Whether the axis is horizontal or vertical
 * @param tickPadding The padding between the tick marks and the tick labels
 * @param tickSize The size/length of the tick marks
 */
function drawAxisCompact(
    context,
    scale,
    position,
    padding,
    horizontal,
    tickPadding = 3,
    tickSize = 6,
) {

    // Tick labels
    if (horizontal) {
        context.textAlign = "center";
        context.textBaseline = "top";
    } else {
        context.textAlign = "right";
        context.textBaseline = "middle";
    }

    const [start, end] = scale.range(),
        tickFormat = scale.tickFormat ? scale.tickFormat() : d => d,
        ticks = (scale.ticks ? scale.ticks() : scale.domain()).map(d => {
            const label = tickFormat(d);
            return {
                pos: scale(d) + (scale.bandwidth ? scale.bandwidth() / 2 : 0),
                label: label,
                textMetrics: context.measureText(label)
            }
        });

    // Flip coords if vertical
    let coord, c;
    if (horizontal) {
        coord = (x, y) => [x, position + y]
        c = (x, y) => [x, y]
    } else {
        coord = (x, y) => [position - y, x]
        c = (x, y) => [-y, x]
    }

    // Set up context
    context.lineWidth = 1;
    context.strokeStyle = "black";  // Line color
    context.fillStyle = "black";    // Font color

    // Clear the axis part of the plot
    context.clearRect(...coord(start, 0), ...c(end - start, padding));

    context.beginPath();
    // Line
      const p = (ticks[0].textMetrics.fontBoundingBoxAscent + ticks[0].textMetrics.fontBoundingBoxDescent) / 2;
    context.lineTo(...coord(start, p));
    context.lineTo(...coord(end, p));
    context.stroke();

    ticks.forEach(d => {
        context.clearRect(
            ...coord(d.pos - d.textMetrics.width / 2 - 2, -d.textMetrics.fontBoundingBoxAscent),
            d.textMetrics.width + 4,
            d.textMetrics.fontBoundingBoxDescent + d.textMetrics.fontBoundingBoxAscent
        );
        context.fillText(d.label, ...coord(d.pos, 0));
    });
}

class CanvasPlot {
    element;
    canvas;
    context;
    position;
    width;
    height;
    x_axis_padding;
    y_axis_padding;
    x;
    y;

    /**
     * Creates a canvas and axis elements to be drawn on a canvas plot
     *
     * @param element
     * @param width
     * @param height
     * @param x_scale
     * @param y_scale
     * @returns {{canvas, drawAxes: drawAxes, context: *, width, x: *, clear: clear, y: *, position: {x: number, y: number}, x_axis_padding: *, y_axis_padding: *, height}}
     */
    constructor(element, width, height, x_scale, y_scale, invert_y=false, draw_x_axis=true, draw_y_axis=true) {
        this.element = element.append("div").style("position", "relative").style("height", height + "px").style("width", width + "px");
        this.canvas = this.element.append("canvas").attr("width", width).attr("height", height);
        this.context = this.canvas.node().getContext("2d")
        this.position = {x: 0, y: 0}
        this.width = width
        this.height = height
        this.x_axis_padding = draw_x_axis ? 10 : 0;
        this.y_axis_padding = draw_y_axis ? 50 : 0;
        this.invert_y = invert_y
        this.draw_x_axis = draw_x_axis;
        this.draw_y_axis = draw_y_axis;

        // Create plot elements
        this.x = x_scale.range([this.position.x + this.y_axis_padding, this.position.x + width])
        if (invert_y) {
            this.y = y_scale.range([this.position.y, this.position.y + height - this.x_axis_padding])
        } else {
            this.y = y_scale.range([this.position.y + height - this.x_axis_padding, this.position.y])
        }
    }

    drawAxes() {
        console.log('draw axes', this.draw_x_axis, this.draw_y_axis)
        if (this.draw_x_axis) drawAxisCompact(this.context, this.x, this.y.range()[this.invert_y ? 1 : 0], this.x_axis_padding, true);
        if (this.draw_y_axis) drawAxis(this.context, this.y, this.x.range()[0], this.y_axis_padding, false);
    }

    clear() {
        this.context.clearRect(this.position.x, this.position.y - 1, this.width, this.height);
    }
}

    function drawLegend(legend_container) {
        const legend = legend_container
            .style("margin-left", "10px")
            .style("margin-top", "10px")
            .append("div")
            .style("border", "1px solid black")
            .style("padding", "5px");
        for (const k of Object.keys(settings.colors)) {
            const l = legend.append("div")
            l.append("span")
                .style("display", "inline-block")
                .style("width", "10px")
                .style("height", "10px")
                .style("background-color", settings.colors[k]);
            l.append("span").text(k).style("padding-left", "5px");
        }
    }

    class ErrorBarPlot {
        constructor(canvas_plot, num_bins, words, style='absolute', scaleExcludeCorrect=false) {
            this.plot = canvas_plot;
            this.bin = d3.bin().thresholds(200).value(d => (d.begin_time + d.end_time) / 2)
            this.words = words;
            this.max = 0;
            this.binned_words = [];
            this.style = style;
            this.scaleExcludeCorrect = scaleExcludeCorrect;

            this.updateBins();
        }

        updateBins() {
            var bin_max = 0;
            const self = this;

            this.binned_words = this.bin.domain(this.plot.x.domain())(this.words).map(d => {
                // This is for utterances
                // d.substitutions = d.map(i => i.substitutions).reduce((a, b) => a + b, 0);
                // d.insertions = d.map(i => i.insertions || 0).reduce((a, b) => a + b, 0);
                // d.deletions = d.map(i => i.deletions || 0).reduce((a, b) => a + b, 0);
                // d.total = d.map(i => i.total || 0).reduce((a, b) => a + b, 0);
                d.substitutions = d.map(w => w.match_type === 'substitution').reduce((a, b) => a + b, 0);
                d.insertions = d.map(w => w.match_type === 'insertion').reduce((a, b) => a + b, 0);
                d.deletions = d.map(w => w.match_type === 'deletion').reduce((a, b) => a + b, 0);
                d.total = d.length;

                // Compute relative numbers if requested
                if (self.style === 'relative') {
                    d.substitutions = d.substitutions / (d.total || d.substitutions || 1);
                    d.insertions = d.insertions / (d.total || d.insertions || 1);
                    d.deletions = d.deletions / (d.total || d.deletions || 1);
                    d.total = 1;
                }

                // Compute upper limit of plot
                if (self.scaleExcludeCorrect) {
                    bin_max = Math.max(bin_max, d.substitutions + d.insertions + d.deletions);
                } else {
                    bin_max = Math.max(bin_max, d.total, d.substitutions + d.insertions + d.deletions);
                }
                return d
            });
            this.max = bin_max;
            this.plot.y.domain([0, bin_max * 1.1]);
        }

        zoomTo(x0, x1) {
            if ([x0, x1] == this.plot.x.domain()) return;
            this.plot.x.domain([x0, x1]);
            this.updateBins();
            this.draw();
        }

        drawBars() {
            const self = this;
            this.binned_words.forEach(b => {
                const x = this.plot.x(b.x0);
                const width = this.plot.x(b.x1) - this.plot.x(b.x0);
                var y = 0;
                const bottom = this.plot.y(0);
                y = (y) => this.plot.y(y) - bottom;

                this.plot.context.strokeStyle = "gray";
                this.plot.context.fillStyle = settings.colors["correct"];
                this.plot.context.beginPath();
                this.plot.context.rect(x, bottom, width, y(b.total));
                this.plot.context.stroke();
                this.plot.context.fill();

                // Substitutions
                var height = y(b.substitutions);
                this.plot.context.fillStyle = settings.colors["substitution"];
                this.plot.context.fillRect(x, bottom, width, height)
                var bottom_ = bottom + height;

                // Insertions
                height = y(b.insertions);
                this.plot.context.fillStyle = settings.colors["insertion"];
                this.plot.context.fillRect(x, bottom_, width, height)
                bottom_ = bottom_ + height;

                // Deletions
                height = y(b.deletions);
                this.plot.context.fillStyle = settings.colors["deletion"];
                this.plot.context.fillRect(x, bottom_, width, height)
            });
        }

        draw() {
            this.plot.clear();
            this.drawBars();
            this.plot.drawAxes();
        }
    }

    class WordPlot {
        constructor(plot, words) {
            this.plot = plot;
            this.words = words;
        }

        drawWords() {
            const [begin, end] = this.plot.x.domain();
            this.plot.context.strokeStyle = "black";
            this.words.filter(d => d.begin_time < end && d.end_time > begin).forEach(u => {
                this.plot.context.beginPath();
                let y_;
                if (u.source === "hypothesis") {
                    y_ = this.plot.y(u.speaker_id) + this.plot.y.bandwidth() / 2;
                } else {
                    y_ = this.plot.y(u.speaker_id);
                }
                this.plot.context.rect(
                    this.plot.x(u.begin_time),
                    y_,
                    this.plot.x(u.end_time) - this.plot.x(u.begin_time),
                    this.plot.y.bandwidth() / 2,
                );
                if (u.match_type !== undefined) {
                    this.plot.context.fillStyle = settings.colors[u.match_type];
                    this.plot.context.fill();
                } else {
                    this.plot.context.stroke();
                }
            })
        }

        zoomTo(x0, x1) {
            this.plot.x.domain([x0, x1]);
            this.draw();
        }

        draw() {
            this.plot.clear();
            this.drawWords();
            this.plot.drawAxes();
        }
    }

    class Minimap {
        constructor(element, width, height, x_scale, y_scale, words) {
            const e = element.append('div')
                .style("width", width + "px")
                .style("position", "relative")
                .style("background", "#eAeAeA")
                .style("margin-bottom", "5px");

            this.error_bars = new ErrorBarPlot(
                new CanvasPlot(e, width, 60,
                x_scale,
                d3.scaleLinear().domain([1, 0]),
                    false, false, true,
            ), 200, words, settings.barplot.style, settings.barplot.scaleExcludeCorrect);
            this.word_plot = new WordPlot(
                new CanvasPlot(e, width, 100, x_scale, y_scale,
                    false, true, true,),
                words
            );

            this.svg = e.append("svg")
                .attr("width", width).attr("height", this.error_bars.plot.height + this.word_plot.plot.height)
                .style("position", "absolute").style("top", 0).style("left", 0);

            this.brush = d3.brushX()
                .extent([
                    [
                        Math.max(this.error_bars.plot.y_axis_padding, this.word_plot.plot.y_axis_padding),
                        0
                    ],
                    [width, 175 - this.word_plot.plot.x_axis_padding]])
                .on("brush", this._onselect.bind(this))
                .on("end", this._onselect.bind(this));

            this.brush_group = this.svg.append("g")
                .attr("class", "brush")
                .call(this.brush);

            this.on_select_callbacks = [];

            this.max_range = this.word_plot.plot.x.range();
            this.selection = this.word_plot.plot.x.range();
        }

        draw() {
            this.error_bars.draw();
            this.word_plot.draw();
        }

        zoomTo(x0, x1) {
            this.error_bars.zoomTo(x0, x1);
            this.word_plot.zoomTo(x0, x1);
            this._callOnSelectCallbacks();
        }

        _onselect(event) {
            if (event.selection === null) {
                this.selection = this.max_range;
            } else {
                this.selection = event.selection;
            }
            this._callOnSelectCallbacks();
        }

        _callOnSelectCallbacks() {
            let [x0, x1] = this.selection;
            x0 = this.word_plot.plot.x.invert(x0);
            x1 = this.word_plot.plot.x.invert(x1);
            this.on_select_callbacks.forEach(c => c(x0, x1));
        }

        onSelect(callback) {
            this.on_select_callbacks.push(callback);
        }
    }

    class PlayHead {
        constructor(canvas, context, global_context, global_x_position, x_scale, y_scale, begin, end, src) {
            this.canvas = canvas;
            this.context = context;
            this.x = x_scale;
            this.y = y_scale;
            this.begin = begin;
            this.end = end;
            this.h = new Howl({src: src})
            console.log(this.h)
            this.position = 0;
            this.animationFrameID = null;
            this.h.once('end', () => this.remove.bind(this))
            this.audio_data = null
            this.global_context = global_context
            this.global_x_position = global_x_position

            const self = this;
            fetch(src)
                .then(
                    r => r.arrayBuffer().then(
                        b => new AudioContext().decodeAudioData(b).then(
                            a => {
                                self.audio_data = a.getChannelData(0);
                                self.drawAudio();
                            }
                        )
                    )
                )

        }

        clearPlayHead() {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        draw() {
            const position = this.begin + (this.end - this.begin) * this.position;
            this.clearPlayHead();
            this.context.strokeStyle = 'pink';
            this.context.lineWidth = 4;
            this.context.beginPath();
            this.context.moveTo(this.x.bandwidth() / 2 + 20, this.y(position));
            this.context.lineTo(this.x.bandwidth(), this.y(position));
            this.context.stroke();
            this.context.beginPath();
            this.context.strokeStyle = 'black';
            this.context.lineWidth = 1;
            this.context.moveTo(this.x.bandwidth() / 2 + 20, this.y(position));
            this.context.lineTo(this.x.bandwidth(), this.y(position));
            this.context.stroke();
        }

        play() {
            this.h.stop();
            this.h.play();
            this.tick();
        }

        stop() {
            this.h.stop();
        }

        tick() {
            this.position = (this.h.seek() || 0) / this.h.duration();
            this.draw();
            this.animationFrameID = requestAnimationFrame(this.tick.bind(this));
        }

        remove() {
            if (this.animationFrameID !== null) cancelAnimationFrame(this.animationFrameID);
            this.clearPlayHead();
        }

        drawAudio() {
            if (this.audio_data == null) return;
            const begin = this.y(this.begin)
            const end = this.y(this.end)
            const length = end - begin;
            const data_length = this.audio_data.length;
            const scale = length / data_length;
            var prevY = 0;
            var max = 0;
            const vscale = 100

            this.global_context.beginPath()
            this.global_context.moveTo(this.global_x_position, begin);
            for (let i = 0; i <= data_length; i++) {
                const y = Math.round(i * scale)
                if (y > prevY) {
                    const x = this.global_x_position + Math.round(max * vscale)
                    this.global_context.lineTo(x, prevY + begin)
                    prevY = y;
                    max = 0;
                }
                max = Math.max(Math.abs(this.audio_data[i] || 0), max)
            }
            this.global_context.fillStyle = 'gray';
            this.global_context.fill();
        }
    }


    class DetailsPlot {
        constructor(plot, words, utterances, alignment) {
            this.plot = plot;
            this.words = words;
            this.filtered_words = words;
            this.utterances = utterances;
            this.filtered_utterances = utterances;
            this.alignment = alignment;
            this.speaker_ids = utterances.map(d => d.speaker_id);
            this.max_length = plot.y.domain()[1];

            this.playhead = null

            // Create elements for click handlers
            const container = this.plot.element.append("div")
                .style("position", "absolute")
                .style("top", 0)
                .style("left", 0)
                .style("width", "100%")
                .style("height", "100%");
            container.selectAll("div").data(this.plot.x.domain())
                .enter()
                .append("div")
                // .style("background-color", "red")
                .style("position", "absolute")
                .style("top", 0)
                .style("left", d => this.plot.x(d) + "px")
                .style("height", "100%")
                .style("width", this.plot.x.bandwidth() + "px")
                .on("click", this.click.bind(this))
                .append("canvas")
                .attr("id", d => "canvas-" + d)
                .attr("height", this.plot.height)
                .attr("width", this.plot.x.bandwidth())
                .style("width", "100%")
                .style("height", "100%")

            // TODO: allow scrolling and dragging and ctrl+scroll for zoom
            this.plot.element.on("wheel", (event) => {
                let [begin, end] = this.plot.y.domain();
                let delta = (this.plot.y.invert(event.deltaY) - this.plot.y.invert(0)) * 0.3
                if (event.ctrlKey) {
                    begin = Math.max(0, begin - delta);
                    end = Math.min(end + delta, this.max_length);
                } else {
                    if (end + delta > this.max_length) delta = this.max_length - end;
                    if (begin + delta < 0) delta = -begin;
                    begin = begin + delta;
                    end = end + delta;
                }
                // TODO: We shouldn't call zoomTo here because it would create an update loop
                this._callOnScrollHandlers(begin, end);
                event.preventDefault();
            }, false)

            this.onscrollhandlers = [];
        }

        click(event, speaker_id) {
            if (this.playhead !== null) this.playhead.stop();
            const screenY = event.layerY;
            const y = this.plot.y.invert(screenY);
            const utterance_candidates = this.filtered_utterances.filter(
                u => u.begin_time < y && u.end_time > y && u.speaker_id === speaker_id && u.source === "hypothesis"
            )
            if (utterance_candidates.length === 0) return;
            const utterance = utterance_candidates[0];
            const canvas = d3.select('#canvas-' + speaker_id).node()
            this.playhead = new PlayHead(
                canvas, canvas.getContext("2d"),
                this.plot.context,
                this.plot.x(speaker_id) + this.plot.x.bandwidth(),
                this.plot.x, this.plot.y, utterance.begin_time, utterance.end_time,
                // TODO: remove fallback
                utterance.audio || 'example.wav'
            )
            this.playhead.play();
            this.draw();
        }

        onScroll(callback) {
            this.onscrollhandlers.push(callback);
        }

        _callOnScrollHandlers(x0, x1) {
            this.onscrollhandlers.forEach(c => c(x0, x1));
        }

        drawYAxisLabels() {
            const ticks = this.plot.x.domain().map(d => {
                return {
                    pos: this.plot.x(d) + (this.plot.x.bandwidth ? this.plot.x.bandwidth() / 2 : 0),
                    label: d
                }
            })
            const position = this.plot.y.range()[1];
            const tickSize = 6;
            const gap = 10;
            const offset = (this.plot.x.bandwidth()) / 4;
            const tickPadding = 3;
            this.plot.context.textAlign = "center";
            this.plot.context.textBaseline = "top";
            const Y = position;
            ticks.forEach(d => {
                this.plot.context.beginPath();
                this.plot.context.rect(d.pos - this.plot.x.bandwidth() / 2, Y, this.plot.x.bandwidth(), this.plot.x_axis_padding);
                this.plot.context.fillStyle = "white";
                this.plot.context.strokeStyle = "black";
                this.plot.context.fill();
                this.plot.context.stroke();
                this.plot.context.beginPath();
                this.plot.context.moveTo(d.pos - 2 * gap, Y);
                this.plot.context.lineTo(d.pos - 2 * gap, Y + tickSize);
                this.plot.context.moveTo(d.pos + 2 * gap, Y);
                this.plot.context.lineTo(d.pos + 2 * gap, Y + tickSize);
                this.plot.context.moveTo(d.pos + this.plot.x.bandwidth() / 2, Y);
                this.plot.context.lineTo(d.pos + this.plot.x.bandwidth() / 2, Y + tickSize);
                this.plot.context.moveTo(d.pos - this.plot.x.bandwidth() / 2, Y);
                this.plot.context.lineTo(d.pos - this.plot.x.bandwidth() / 2, Y + tickSize);
                this.plot.context.stroke();
                this.plot.context.fillStyle = "black";
                this.plot.context.fillText(d.label, d.pos, position + tickSize + tickPadding)
                this.plot.context.fillText("REF", d.pos - offset, Y + tickPadding);
                this.plot.context.fillText("HYP", d.pos + offset, Y + tickPadding);
            });
        }

        drawDetails() {
            const [begin, end] = this.plot.y.domain();

            const filtered_words = this.filtered_words;
            if (filtered_words.length > 3000) return;
            const filtered_utterances = this.filtered_utterances;
            const context = this.plot.context;

            const gap = 10;

            const draw_text = filtered_words.length < 400;
            const draw_boxes = filtered_words.length < 1000;
            const draw_utterance_markers = filtered_words.length < 2000;
            const band_width = Math.floor(this.plot.x.bandwidth() / 2 - 2 * gap);

            // Draw words
            context.font = "12px Arial";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.lineWidth = 1;
            filtered_words.forEach(d => {
                let x_;
                if (d.source === "hypothesis") {
                    x_ = this.plot.x(d.speaker_id) + this.plot.x.bandwidth() / 2 + 2 * gap;
                } else {
                    x_ = this.plot.x(d.speaker_id);
                }

                context.beginPath();
                context.rect(
                    Math.floor(x_),
                    Math.floor(this.plot.y(d.begin_time)),
                    band_width,
                    Math.floor(this.plot.y(d.end_time) - this.plot.y(d.begin_time)));
                context.strokeStyle = 'gray';
                context.fillStyle = settings.colors[d.match_type];
                context.fill();
                if (draw_boxes) context.stroke();

                // Text
                if (draw_text) {
                    x_ += Math.floor(band_width / 2);
                    let y_ = Math.floor(this.plot.y((d.begin_time + d.end_time) / 2));

                    context.fillStyle = '#000';
                    context.fillText(d.transcript, x_, y_);
                }
            })

            // Draw stitches
            const filtered_alignment = this.alignment.filter(d => {
                const begin_time = d.ref_center_time === undefined || d.ref_center_time > d.hyp_center_time ? d.hyp_center_time : d.ref_center_time;
                const end_time = d.ref_center_time === undefined || d.ref_center_time < d.hyp_center_time ? d.hyp_center_time : d.ref_center_time;
                return begin_time < end && end_time > begin;
            });
            context.lineWidth = 3;
            filtered_alignment.forEach(d => {
                const x_ref = this.plot.x(d.ref_speaker_id) + this.plot.x.bandwidth() / 2;
                const x_hyp = this.plot.x(d.hyp_speaker_id) + this.plot.x.bandwidth() / 2;
                context.beginPath();
                context.strokeStyle = settings.colors[d.match_type];
                if (d.hyp_center_time === undefined) {
                    const y = this.plot.y(d.ref_center_time);
                    context.moveTo(x_ref - 2 * gap, y);
                    context.lineTo(x_hyp, y);
                } else if (d.ref_center_time === undefined) {
                    const y = this.plot.y(d.ref_center_time);
                    context.moveTo(x_ref, y);
                    context.lineTo(x_hyp + 2 * gap, y);
                } else {
                    const xl = x_ref - 2 * gap;
                    const yl = this.plot.y(d.ref_center_time)
                    const xr = x_hyp + 2 * gap;
                    const yr = this.plot.y(d.hyp_center_time)
                    context.moveTo(xl - gap / 4, yl);
                    context.lineTo(xl + gap / 4, yl);
                    context.lineTo(xr - gap / 4, yr);
                    context.lineTo(xr + gap / 4, yr);
                }
                context.stroke();
            });

            // Draw utterance begin and end markers
            if (draw_utterance_markers) {
                context.strokeStyle = "orange";
                context.lineWidth = 2;
                filtered_utterances.forEach(d => {
                    context.beginPath();
                    var x = this.plot.x(d.speaker_id);
                    if (d.source == "hypothesis") {
                        x += this.plot.x.bandwidth() / 2 + 2 * gap;
                    }

                    var y = this.plot.y(d.begin_time);
                    context.moveTo(x - gap, y);
                    context.lineTo(x + this.plot.x.bandwidth() / 2 - gap, y);
                    context.stroke();

                    y = this.plot.y(d.end_time);
                    context.moveTo(x - gap, y);
                    context.lineTo(x + this.plot.x.bandwidth() / 2 - gap, y);
                    context.stroke();
                });
            }
        }

        draw() {
            this.plot.clear();
            this.drawDetails();
            if (this.playhead !== null) this.playhead.drawAudio();
            this.plot.drawAxes();
            this.drawYAxisLabels();
        }

        zoomTo(x0, x1) {
            this.plot.y.domain([x0, x1]);
            this.filtered_words = this.words.filter(w => w.begin_time < x1 && w.end_time > x0);
            this.filtered_utterances = this.utterances.filter(w => w.begin_time < x1 && w.end_time > x0);
            this.draw();
        }
    }


    // Data preprocessing
    const utterances = data.utterances;
    const words = data.words;
    const alignment = data.alignment;

    const time_domain = [0, Math.max.apply(null, (utterances.map(d => d.end_time))) + 1];
    const speaker_ids = utterances
        // .filter(u => u.source === 'reference')
        .map(d => d.speaker_id)

    // Setup plot elements
    var margin = {top: 30, right: 30, bottom: 70, left: 60},
        width = 1500 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;
    d3.select('#c').style("display", "flex")
    const plot_container = d3.select(element_id).append("div").style("margin", "10px")
    const plot_div = plot_container.append("div").style("position", "relative")
    drawLegend(d3.select(element_id).append("div"));

    const minimaps = []
    console.log(settings)
    for (let i = 0; i < settings.minimaps.number; i++) {
        const minimap = new Minimap(
            plot_div, width, settings.minimaps.height,
            d3.scaleLinear().domain(time_domain),
            d3.scaleBand().domain(speaker_ids).padding(0.1),
            words,
        )
        if (minimaps[i-1] !== undefined) {
            minimaps[i-1].onSelect(minimap.zoomTo.bind(minimap));
        }
        minimaps.push(minimap);
    }

    const details_plot = new DetailsPlot(
        new CanvasPlot(plot_div, width, 700,
            d3.scaleBand().domain(speaker_ids).padding(0.1),
            d3.scaleLinear().domain([time_domain[0], time_domain[1]]),
            true
        ), words, utterances, alignment
    )

    if (minimaps.length > 0) {
        const last_minimap = minimaps[minimaps.length - 1];
        last_minimap.onSelect(details_plot.zoomTo.bind(details_plot));
        details_plot.onScroll((x0, x1) => {
            last_minimap.brush_group.call(last_minimap.brush.move, [
                last_minimap.word_plot.plot.x(x0), last_minimap.word_plot.plot.x(x1)
            ])
        });
    } else {
        // This is necessary to prevent update loops. We can't call details_plot.zoomTo in details_plot...
        details_plot.onScroll(details_plot.zoomTo.bind(details_plot));
    }

    for (const minimap of minimaps) minimap.draw();
    details_plot.draw();
}