Tiny fragmented MP4s for `tests/features/media/mux.test.js`, made with ffmpeg
in the same shape as Reddit's separate video and audio streams (one second of
test pattern, and one second of a 440 Hz tone):

    F="-movflags frag_keyframe+empty_moov+default_base_moof"
    ffmpeg -f lavfi -i testsrc=size=64x36:rate=10 -t 1 -c:v libx264 -pix_fmt yuv420p -profile:v baseline $F video.mp4
    ffmpeg -f lavfi -i sine=frequency=440:duration=1 -c:a aac -b:a 32k $F audio.mp4
